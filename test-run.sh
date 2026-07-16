kill -9 $(ps aux | grep node | grep tsx | awk '{print $2}') || true
npm run dev:backend > backend-test.log 2>&1 &
sleep 5
node backend/test-stream-local.mjs &
sleep 6
kill -9 $(ps aux | grep node | grep tsx | awk '{print $2}') || true
cat backend-test.log
