javascript:(function(){
    /* ===== 네이버 지도 URL 추출기 =====
       by suhmieum
       - 검색결과 없음 예외처리 추가
    */

    /* ---------- 스타일 ---------- */
    var style = document.createElement('style');
    style.innerHTML =
        '#placeIdExtractor{position:fixed;top:20px;right:20px;width:450px;background:#fff;border:2px solid #03c75a;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.3);z-index:999999;font-family:sans-serif}' +
        '#placeIdExtractor h3{background:#03c75a;color:#fff;margin:0;padding:0 15px;border-radius:10px 10px 0 0;font-size:16px;display:flex;align-items:center;height:48px;box-sizing:border-box;cursor:move}' +
        '#placeIdExtractor .close{margin-left:auto;width:24px;height:24px;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}' +
        '#placeIdExtractor .content{padding:20px}' +
        '#placeIdExtractor textarea{width:calc(100% - 20px);min-height:120px;border:1px solid #ddd;border-radius:6px;padding:10px;font-family:monospace;font-size:12px;margin:10px 0;resize:vertical;box-sizing:border-box}' +
        /* 결과창: 줄바꿈 유지(키워드별 한 줄), 줄 내 가로 스크롤 */
        '#placeIdExtractor #resultOutput{overflow-x:auto;white-space:pre;word-break:keep-all}' +
        '#placeIdExtractor textarea::placeholder{color:#999;}' +
        '#placeIdExtractor button{background:#03c75a;color:#fff;border:none;padding:10px 15px;border-radius:6px;cursor:pointer;margin:5px 2px;font-size:14px}' +
        '#placeIdExtractor button:hover{background:#028a4e}' +
        '#placeIdExtractor .status{background:#f8f9fa;padding:10px;border-radius:6px;margin:10px 0;font-size:12px;max-height:150px;overflow-y:auto}' +
        '#placeIdExtractor .current-keyword{background:#e3f2fd;padding:8px;border-radius:4px;margin:10px 0;font-weight:bold;color:#1976d2}';
    document.head.appendChild(style);

    /* ---------- 이미 열렸으면 닫기 ---------- */
    var old = document.getElementById('placeIdExtractor');
    if (old) { old.remove(); return; }

    /* ---------- 모달 ---------- */
    var extractor = document.createElement('div');
    extractor.id = 'placeIdExtractor';
    extractor.innerHTML =
        '<h3 id="dragHandle">네이버 지도 URL 추출기<button class="close" onclick="this.parentElement.parentElement.remove()">×</button></h3>' +
        '<div class="content">' +
            '<textarea id="keywordInput" placeholder="키워드를 한 줄에 하나씩 입력하세요.&#10;&#10;예시)&#10;비상교육&#10;정발산&#10;북악터널&#10;서울시립미술관"></textarea>' +
            '<button onclick="startExtraction()">🚀 추출 시작</button>' +
            '<button onclick="copyResult()">📋 주소 복사</button>' +
            '<button onclick="clearResults()" style="background:#dc3545">🗑️ 초기화</button>' +
            '<div id="currentKeyword" class="current-keyword" style="display:none"></div>' +
            '<div id="status" class="status">키워드를 입력하고 \"추출 시작\" 버튼을 클릭하세요.</div>' +
            '<textarea id="resultOutput" placeholder="결과가 여기에 표시됩니다..." readonly></textarea>' +
        '</div>';
    document.body.appendChild(extractor);

    /* ---------- 드래그 이동 ---------- */
    (function enableDrag(el, handle) {
        var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        handle.addEventListener('mousedown', dragMouseDown);
        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.addEventListener('mouseup', closeDrag);
            document.addEventListener('mousemove', elementDrag);
            /* right → left 전환(첫 드래그 시) */
            if (getComputedStyle(el).right !== 'auto') {
                el.style.left = el.getBoundingClientRect().left + 'px';
                el.style.right = 'auto';
            }
        }
        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            el.style.top  = (el.offsetTop  - pos2) + 'px';
            el.style.left = (el.offsetLeft - pos1) + 'px';
        }
        function closeDrag() {
            document.removeEventListener('mouseup', closeDrag);
            document.removeEventListener('mousemove', elementDrag);
        }
    })(extractor, extractor.querySelector('#dragHandle'));

    /* ---------- 전역 상태 ---------- */
    window.extractorData = {
        keywords: [],
        results: [],          // "키워드\tURL"
        currentIndex: 0,
        isRunning: false,
        messageListener: null,
        waitingForData: false,
        currentKeyword: ''
    };

    /* ---------- PostMessage 리스너 ---------- */
    function setupMessageListener() {
        if (window.extractorData.messageListener)
            window.removeEventListener('message', window.extractorData.messageListener);

        window.extractorData.messageListener = function (event) {
            if (event.origin !== 'https://pcmap.place.naver.com') return;
            if (event.data && typeof event.data === 'object') {
                if (window.extractorData.waitingForData) processMessageData(event.data);
            }
        };
        window.addEventListener('message', window.extractorData.messageListener);
        updateStatus('📡 PostMessage 리스너 설정 완료');
    }

    /* ---------- 메시지 처리 (수정된 버전) ---------- */
    function processMessageData(data) {
        // 1. place-search-update 액션이 아니면 무시
        if (!data.action || data.action !== 'place-search-update') {
            return;
        }
        
        // 2. data.data가 없으면 무시
        if (!data.data) {
            return;
        }
        
        // 3. list가 없거나 빈 배열이면 검색결과 없음
        if (!data.data.list || !Array.isArray(data.data.list) || data.data.list.length === 0) {
            updateStatus('❌ 검색결과 없음');
            addResult(window.extractorData.currentKeyword, '검색결과 없음');
            window.extractorData.waitingForData = false;
            setTimeout(nextKeyword, 1000);
            return;
        }
        
        // 4. 첫 번째 결과에서 ID 추출
        var firstPlace = data.data.list[0];
        if (!firstPlace || !firstPlace.id) {
            updateStatus('❌ Place ID를 찾을 수 없음');
            addResult(window.extractorData.currentKeyword, '추출실패 - ID 없음');
            window.extractorData.waitingForData = false;
            setTimeout(nextKeyword, 1000);
            return;
        }
        
        var placeId = firstPlace.id;
        var placeTitle = firstPlace.title || '제목없음';
        
        // 5. ID 유효성 검사
        if (!/^\d{5,15}$/.test(placeId)) {
            updateStatus('❌ 유효하지 않은 Place ID: ' + placeId);
            addResult(window.extractorData.currentKeyword, '추출실패 - 잘못된 ID');
            window.extractorData.waitingForData = false;
            setTimeout(nextKeyword, 1000);
            return;
        }
        
        // 6. 성공!
        var url = 'https://map.naver.com/p/entry/place/' + placeId;
        updateStatus('✅ 성공: ' + placeTitle + ' (ID: ' + placeId + ')');
        addResult(window.extractorData.currentKeyword, url);
        
        window.extractorData.waitingForData = false;
        setTimeout(nextKeyword, 1000);
    }

    /* ---------- 추출 시작 ---------- */
    window.startExtraction = function () {
        if (window.extractorData.isRunning) { alert('현재 실행 중입니다!'); return; }
        var ks = document.getElementById('keywordInput').value
            .trim().split(/\n/).map(function (k) { return k.trim(); }).filter(Boolean);
        if (!ks.length) { alert('키워드를 입력하세요!'); return; }

        Object.assign(window.extractorData, { keywords: ks, results: [], currentIndex: 0, isRunning: true });
        document.getElementById('resultOutput').value = '';
        setupMessageListener();
        processCurrentKeyword();
    };

    /* ---------- 키워드 순회 ---------- */
    function processCurrentKeyword() {
        if (window.extractorData.currentIndex >= window.extractorData.keywords.length) { finishExtraction(); return; }
        var kw = window.extractorData.keywords[window.extractorData.currentIndex];
        window.extractorData.currentKeyword = kw;
        updateStatus('🔍 검색 중: ' + kw + ' (' + (window.extractorData.currentIndex + 1) + '/' + window.extractorData.keywords.length + ')');
        var kwDiv = document.getElementById('currentKeyword');
        kwDiv.style.display = 'block';
        kwDiv.innerHTML = '📍 현재: <strong>' + kw + '</strong>';
        performSearch(kw);
    }

    /* ---------- 검색 ---------- */
    function performSearch(keyword) {
        var input = document.querySelector('input.input_search');
        if (!input) { addResult(keyword, '검색실패 - 검색창 없음'); nextKeyword(); return; }

        window.extractorData.waitingForData = true;
        setReactInputValue(input, keyword);

        setTimeout(function () {
            executeSearch(input);
            /* 10초 안에 메시지 못 받으면 타임아웃 */
            setTimeout(function () {
                if (window.extractorData.waitingForData) {
                    updateStatus('⏰ 타임아웃 - PostMessage 수신 실패');
                    addResult(keyword, '추출실패 - 타임아웃');
                    window.extractorData.waitingForData = false;
                    nextKeyword();
                }
            }, 10000);
        }, 500);
    }

    /* React 입력창 값 세팅 */
    function setReactInputValue(input, val) {
        input.focus(); input.select(); document.execCommand('delete');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, val);
        ['input', 'change'].forEach(function (t) {
            var e = new Event(t, { bubbles: true });
            e.simulated = true; input.dispatchEvent(e);
        });
    }
    function executeSearch(input) {
        var btn = document.querySelector('button.button_search');
        if (btn) btn.click();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        updateStatus('📡 PostMessage 대기 중...');
    }

    /* ---------- 결과 ---------- */
    function addResult(k, u) {
        window.extractorData.results.push(k + '\t' + u);
        document.getElementById('resultOutput').value = window.extractorData.results.join('\n');
    }
    function nextKeyword() {
        window.extractorData.currentIndex++;
        setTimeout(processCurrentKeyword, 3000);
    }
    function updateStatus(m) {
        document.getElementById('status').innerHTML =
            '[' + new Date().toLocaleTimeString() + '] ' + m;
    }

    /* ---------- 종료 ---------- */
    function finishExtraction() {
        window.extractorData.isRunning = false;
        window.extractorData.waitingForData = false;
        document.getElementById('currentKeyword').style.display = 'none';
        if (window.extractorData.messageListener)
            window.removeEventListener('message', window.extractorData.messageListener);
        var ok = window.extractorData.results.filter(function (r) { return r.includes('place'); }).length;
        updateStatus('🎉 모든 키워드 완료! 성공: ' + ok + '/' + window.extractorData.keywords.length);
        alert('🎉 추출 완료!\n성공: ' + ok + '/' + window.extractorData.keywords.length);
    }

    /* ---------- 주소 복사 ---------- */
    window.copyResult = function () {
        if (!window.extractorData.results.length) { alert('복사할 결과가 없습니다!'); return; }
        var urls = window.extractorData.results
            .map(function (r) { var p = r.split('\t'); return p.length > 1 ? p[1] : p[0]; })
            .join('\n');
        if (navigator.clipboard) {
            navigator.clipboard.writeText(urls).then(
                function () { alert('주소만 복사되었습니다! 스프레드시트에 붙여넣으세요.'); },
                function () { fallbackCopy(urls); }
            );
        } else fallbackCopy(urls);

        function fallbackCopy(text) {
            var tmp = document.createElement('textarea');
            tmp.style.position = 'fixed'; tmp.style.opacity = '0';
            tmp.value = text; document.body.appendChild(tmp);
            tmp.select(); document.execCommand('copy');
            document.body.removeChild(tmp);
            alert('주소만 복사되었습니다! 스프레드시트에 붙여넣으세요.');
        }
    };

    /* ---------- 초기화 ---------- */
    window.clearResults = function () {
        if (!confirm('모든 결과를 지울까요?')) return;
        if (window.extractorData.messageListener)
            window.removeEventListener('message', window.extractorData.messageListener);
        window.extractorData = {
            keywords: [], results: [], currentIndex: 0, isRunning: false,
            messageListener: null, waitingForData: false, currentKeyword: ''
        };
        document.getElementById('resultOutput').value = '';
        document.getElementById('currentKeyword').style.display = 'none';
        updateStatus('🗑️ 초기화 완료. 새로운 키워드를 입력하세요!');
    };
})();
