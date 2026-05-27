#!/bin/bash
# 🌌 JavaF local frontend static web server helper
echo "========================================================================"
echo "🌌 JavaF Exchange (HF-X) 로컬 프론트엔드 웹 서버 기동"
echo "========================================================================"
echo "💡 브라우저의 보안 정책(CORS)으로 인해 ES6 Modules(type=\"module\")은"
echo "   file:/// 주소로 직접 열 경우 스크립트 실행이 차단됩니다."
echo "   따라서 본 HTTP 정적 서버를 통해 로컬 호스트로 안전하게 접속합니다."
echo ""
echo "👉 접속 주소: http://localhost:8000/main.html"
echo "👉 어드민 접속: http://localhost:8000/admin.html"
echo "========================================================================"
echo ""

# Run Python3 built-in HTTP server serving the frontend directory on port 8000
python3 -m http.server --directory /home/administrator/exchange_be/frontend 8000
