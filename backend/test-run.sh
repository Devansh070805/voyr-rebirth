kill -9 $(ps aux | grep node | grep tsx | awk '{print $2}')
npm run dev:backend > backend-test.log 2>&1 &
sleep 5
node test-stream-local.mjs &
sleep 6
kill -9 $(ps aux | grep node | grep tsx | awk '{print $2}')
cat backend-test.log
