#!/usr/bin/env bash
# Security smoke test against a running dev server + seeded emulator.
# Usage: npm run seed && bash scripts/smoke.sh
set -u
BASE=${BASE:-http://localhost:3000}
AUTH="http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key"
fail=0

token() { curl -s "$AUTH" -H 'content-type: application/json' -d "{\"email\":\"$1\",\"password\":\"demo1234\",\"returnSecureToken\":true}" | node -pe 'JSON.parse(require("fs").readFileSync(0)).idToken'; }
# expect <status> <method> <path> <token> [body]
expect() {
  local code
  code=$(curl -s -o /tmp/flylast-smoke.json -w '%{http_code}' -X "$2" "$BASE$3" -H "authorization: Bearer $4" -H 'content-type: application/json' ${5:+-d "$5"})
  if [ "$code" = "$1" ]; then echo "ok   $1 $2 $3"; else echo "FAIL $2 $3 → $code (want $1): $(cat /tmp/flylast-smoke.json)"; fail=1; fi
}

PAX='{"passengers":["Test Passenger"],"contact":"0300 1234567"}'
# open_seats <token> <offerId> <n> → JSON array of n open seat labels
open_seats() { curl -s "$BASE/api/offers/$2/seats" -H "authorization: Bearer $1" | node -pe "JSON.stringify(Object.entries(JSON.parse(require('fs').readFileSync(0)).seats).filter(([,v])=>v==='open').slice(0,$3).map(([k])=>k))"; }
ADMIN=$(token admin@flylast.demo); AIR=$(token airline@flylast.demo); AGY=$(token agency@flylast.demo)
PEND=$(token pending-airline@flylast.demo); TRV=$(token traveller@flylast.demo)
TRV_UID=$(node -pe "JSON.parse(Buffer.from('$TRV'.split('.')[1],'base64url')).user_id")

echo "— Only individual travellers can subscribe"
for t in "$ADMIN" "$AIR" "$AGY" "$PEND"; do expect 403 POST /api/subscriptions/activate "$t" '{"planId":"premium"}'; done
echo "— Business/admin roles get no traveller offer feed"
for t in "$ADMIN" "$AIR" "$AGY"; do expect 403 GET /api/offers "$t"; done
echo "— Pending airline cannot publish"
expect 403 GET /api/airline/offers "$PEND"
echo "— Traveller cannot use business/admin APIs"
expect 403 GET /api/airline/offers "$TRV"; expect 403 GET /api/admin/stats "$TRV"; expect 403 GET /api/agency/offers "$TRV"
expect 401 GET /api/offers ""

echo "— Unsubscribed traveller sees only locked offers, no booking link"
expect 200 GET /api/offers "$TRV"
grep -q '"locked":false' /tmp/flylast-smoke.json && { echo "FAIL unsubscribed traveller got open offer"; fail=1; }
grep -q 'bookingUrl\|offerPrice' /tmp/flylast-smoke.json && { echo "FAIL locked payload leaks price/url"; fail=1; }
ELITE_ID=$(curl -s "$BASE/api/airline/offers" -H "authorization: Bearer $AIR" | node -pe 'JSON.parse(require("fs").readFileSync(0)).offers.find(o=>o.eligibleSubscriberTiers==="elite").offerId')
PREM_ID=$(curl -s "$BASE/api/airline/offers" -H "authorization: Bearer $AIR" | node -pe 'JSON.parse(require("fs").readFileSync(0)).offers.find(o=>o.eligibleSubscriberTiers==="premium_elite").offerId')
expect 403 POST "/api/offers/$PREM_ID/book" "$TRV" "$PAX"

echo "— Basic traveller: no premium offer, no AI"
expect 200 POST /api/subscriptions/activate "$TRV" '{"planId":"basic"}'
expect 403 POST "/api/offers/$PREM_ID/book" "$TRV" "$PAX"
expect 403 POST /api/ai/discover "$TRV" '{"query":"Doha"}'

echo "— Premium traveller: premium offer yes, elite no"
expect 200 POST /api/subscriptions/activate "$TRV" '{"planId":"premium"}'
SEATS_BEFORE=$(curl -s "$BASE/api/offers" -H "authorization: Bearer $TRV" | node -pe "JSON.parse(require('fs').readFileSync(0)).offers.find(o=>o.offerId==='$PREM_ID').releasedSeats")
TWO=$(open_seats "$TRV" "$PREM_ID" 2)
expect 409 POST "/api/offers/$PREM_ID/book" "$TRV" "{\"seats\":$TWO,\"passengers\":[\"Sara Ahmed\",\"Ali Ahmed\"],\"contact\":\"0300 1234567\"}"   # no hold yet
expect 200 POST "/api/offers/$PREM_ID/hold" "$TRV" "{\"seats\":$TWO}"
FIRST=$(node -pe "$TWO[0]")
expect 409 POST "/api/offers/$PREM_ID/hold" "$AGY" "{\"seats\":[\"$FIRST\"]}"   # agency can't grab a held seat
curl -s "$BASE/api/offers/$PREM_ID/seats" -H "authorization: Bearer $TRV" | grep -q '"mine"' && echo "ok   held seats show as mine" || { echo "FAIL hold not visible"; fail=1; }
curl -s "$BASE/api/offers/$PREM_ID/seats" -H "authorization: Bearer $AGY" | grep -q "\"$FIRST\":\"held\"" && echo "ok   others see seat $FIRST as held" || { echo "FAIL others don't see hold"; fail=1; }
curl -s "$BASE/api/offers/$PREM_ID/seats" -H "authorization: Bearer $AGY" | grep -q "$TRV_UID" && { echo "FAIL seat map leaks holder id"; fail=1; }
expect 200 POST "/api/offers/$PREM_ID/book" "$TRV" "{\"seats\":$TWO,\"passengers\":[\"Sara Ahmed\",\"Ali Ahmed\"],\"contact\":\"0300 1234567\"}"
grep -q '"reference":"FL' /tmp/flylast-smoke.json || { echo "FAIL no booking reference"; fail=1; }
expect 409 POST "/api/offers/$PREM_ID/hold" "$AGY" "{\"seats\":[\"$FIRST\"]}"   # booked seat is gone
SEATS_AFTER=$(curl -s "$BASE/api/offers" -H "authorization: Bearer $TRV" | node -pe "JSON.parse(require('fs').readFileSync(0)).offers.find(o=>o.offerId==='$PREM_ID').releasedSeats")
[ $((SEATS_BEFORE - SEATS_AFTER)) = 2 ] && echo "ok   seats decremented $SEATS_BEFORE → $SEATS_AFTER" || { echo "FAIL seats $SEATS_BEFORE → $SEATS_AFTER"; fail=1; }
expect 400 POST "/api/offers/$PREM_ID/hold" "$TRV" '{"seats":["1A","1B","1C","1D","1E"]}'   # over the 4-seat cap
expect 400 POST "/api/offers/$PREM_ID/hold" "$TRV" '{"seats":["99Z"]}'
expect 403 POST "/api/offers/$ELITE_ID/book" "$TRV" "$PAX"
expect 200 POST /api/ai/discover "$TRV" '{"query":"cheap flight to Doha"}'

echo "— Agency channel: authorized agency can book agency releases, never subscriber-only ones"
AGY_ID=$(curl -s "$BASE/api/agency/offers" -H "authorization: Bearer $AGY" | node -pe 'JSON.parse(require("fs").readFileSync(0)).offers[0].offerId')
ONE=$(open_seats "$AGY" "$AGY_ID" 1)
expect 200 POST "/api/offers/$AGY_ID/hold" "$AGY" "{\"seats\":$ONE}"
expect 200 POST "/api/offers/$AGY_ID/book" "$AGY" "{\"seats\":$ONE,\"passengers\":[\"Imran Qureshi\"],\"contact\":\"0321 5550101\"}"
curl -s "$BASE/api/agency/offers" -H "authorization: Bearer $AGY" | grep -q bookingUrl && { echo "FAIL agency feed leaks bookingUrl"; fail=1; }
AGONLY_ID=$(curl -s "$BASE/api/airline/offers" -H "authorization: Bearer $AIR" | node -pe 'JSON.parse(require("fs").readFileSync(0)).offers.find(o=>!o.distributeToSubscribers).offerId')
expect 403 POST "/api/offers/$AGONLY_ID/book" "$TRV" "$PAX"
curl -s "$BASE/api/offers" -H "authorization: Bearer $TRV" | grep -q "$AGONLY_ID" && { echo "FAIL agency-only release shown to traveller"; fail=1; }

echo "— Revenue protection rejects below-floor offer"
NOW=$(node -pe 'Date.now()'); H=3600000
expect 422 POST /api/airline/offers "$AIR" "{\"flightNumber\":\"X1\",\"origin\":\"KHI\",\"destination\":\"ISB\",\"departureTime\":$((NOW+20*H)),\"baseFare\":20000,\"floorPrice\":12000,\"offerPrice\":9000,\"maxReleasableSeats\":5,\"releasedSeats\":2,\"releaseTime\":$NOW,\"expiryTime\":$((NOW+10*H)),\"bookingCutoff\":$((NOW+12*H)),\"eligibleSubscriberTiers\":\"all\",\"bookingUrl\":\"https://x.example\",\"distributeToAgencies\":true,\"distributeToSubscribers\":true}"

echo "— Cancelling returns seats to sale; only the owner can cancel"
BK=$(curl -s "$BASE/api/bookings" -H "authorization: Bearer $TRV" | node -pe 'JSON.parse(require("fs").readFileSync(0)).bookings[0].bookingId')
BK_SEATS=$(curl -s "$BASE/api/bookings" -H "authorization: Bearer $TRV" | node -pe 'JSON.stringify(JSON.parse(require("fs").readFileSync(0)).bookings[0].seatNumbers)')
expect 404 POST "/api/bookings/$BK/cancel" "$AGY"
expect 200 POST "/api/bookings/$BK/cancel" "$TRV"
expect 409 POST "/api/bookings/$BK/cancel" "$TRV"
node -e "const s=$BK_SEATS;" && curl -s "$BASE/api/offers/$PREM_ID/seats" -H "authorization: Bearer $TRV" | node -e "const m=JSON.parse(require('fs').readFileSync(0)).seats;process.exit($BK_SEATS.every(x=>m[x]==='open')?0:1)" && echo "ok   cancelled seats $BK_SEATS are open again" || { echo "FAIL seats not released"; fail=1; }
expect 200 POST "/api/offers/$PREM_ID/hold" "$TRV" "{\"seats\":$BK_SEATS}"
expect 200 POST "/api/offers/$PREM_ID/book" "$TRV" "{\"seats\":$BK_SEATS,\"passengers\":[\"Sara Ahmed\",\"Ali Ahmed\"],\"contact\":\"0300 1234567\"}"

echo "— Bookings are scoped per role"
expect 200 GET /api/bookings "$AIR"
node -e 'const b=JSON.parse(require("fs").readFileSync("/tmp/flylast-smoke.json")).bookings;process.exit(b.filter(x=>x.status==="confirmed").length===2&&b.some(x=>x.channel==="agency")?0:1)' && echo "ok   airline manifest shows subscriber + agency bookings" || { echo "FAIL airline manifest"; fail=1; }
expect 200 GET /api/bookings "$TRV"
node -e 'const b=JSON.parse(require("fs").readFileSync("/tmp/flylast-smoke.json")).bookings;process.exit(b.every(x=>x.userId===b[0].userId)&&b.length===2?0:1)' && echo "ok   traveller sees only own booking" || { echo "FAIL traveller bookings scope"; fail=1; }

echo "— Admin stats include traveller revenue only"
expect 200 GET /api/admin/stats "$ADMIN"
node -e 'const s=JSON.parse(require("fs").readFileSync("/tmp/flylast-smoke.json"));console.log("     users", s.users.total, "revenue", s.revenue.totalBilled, "bookings", s.marketplace.bookings, "seats", s.marketplace.seatsBooked)'

[ $fail = 0 ] && echo "ALL PASSED" || { echo "SOME CHECKS FAILED"; exit 1; }
