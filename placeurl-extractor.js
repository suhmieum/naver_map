javascript:(function(){
    /* ===== 네이버 지도 URL + 위도경도 + 설명 추출기 =====
       by suhmieum 
       - 위도, 경도, 추출 추가
       - 위키피디아 설명 추출 추가
    */

    /* ---------- 스타일 ---------- */
    var style = document.createElement('style');
    style.innerHTML =
        '#placeIdExtractor{position:fixed;top:20px;right:20px;width:580px;background:#fff;border:2px solid #03c75a;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.3);z-index:999999;font-family:sans-serif}' +
        '#placeIdExtractor h3{background:#03c75a;color:#fff;margin:0;padding:0 15px;border-radius:10px 10px 0 0;font-size:16px;display:flex;align-items:center;height:48px;box-sizing:border-box;cursor:move}' +
        '#placeIdExtractor .close{margin-left:auto;width:24px;height:24px;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}' +
        '#placeIdExtractor .content{padding:20px}' +
        '#placeIdExtractor textarea#keywordInput{width:calc(100% - 20px);min-height:120px;border:1px solid #ddd;border-radius:6px;padding:10px;font-family:monospace;font-size:12px;margin:10px 0;resize:vertical;box-sizing:border-box}' +
        '#placeIdExtractor .result-table{width:100%;border-collapse:collapse;margin:0;font-size:10px;background:#fff}' +
        '#placeIdExtractor .result-table th{background:#f0f0f0;padding:8px 4px;border:1px solid #ddd;font-weight:bold;text-align:center}' +
        '#placeIdExtractor .result-table td{padding:6px 4px;border:1px solid #ddd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '#placeIdExtractor .result-table td.keyword{text-align:center;max-width:100px}' +
        '#placeIdExtractor .result-table td.lat, #placeIdExtractor .result-table td.lng{text-align:center;max-width:80px}' +
        '#placeIdExtractor .result-table td.wiki{text-align:center;max-width:50px;font-weight:bold}' +
        '#placeIdExtractor .result-table td.url{min-width:160px;font-size:9px}' +
        '#placeIdExtractor .result-table-container{height:200px;overflow-y:auto;border:1px solid #ddd;border-radius:6px;margin:10px 0;background:#fafafa}' +
        '#placeIdExtractor .empty-placeholder{text-align:center;padding:60px 20px;color:#999}' +
        '#placeIdExtractor .error{color:#dc3545;font-weight:bold}' +
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
            '<button onclick="copyResult()">📋 결과 복사</button>' +
            '<button onclick="clearResults()" style="background:#dc3545">🗑️ 초기화</button>' +
            '<div id="currentKeyword" class="current-keyword" style="display:none"></div>' +
            '<div id="status" class="status">키워드를 입력하고 \"추출 시작\" 버튼을 클릭하세요.</div>' +
            '<div class="result-table-container">' +
                '<table id="resultTable" class="result-table">' +
                    '<thead>' +
                        '<tr>' +
                            '<th>키워드</th>' +
                            '<th>위도</th>' +
                            '<th>경도</th>' +
                            '<th>URL</th>' +
                            '<th>위키</th>' +
                        '</tr>' +
                    '</thead>' +
                    '<tbody id="resultTableBody">' +
                        '<tr>' +
                            '<td colspan="5" class="empty-placeholder">결과가 여기에 표시됩니다...</td>' +
                        '</tr>' +
                    '</tbody>' +
                '</table>' +
            '</div>' +
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
        results: [],          // 전체 정보가 담긴 배열
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

    /* ---------- 메시지 처리 (확장된 버전) ---------- */
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
            var currentKw = window.extractorData.keywords[window.extractorData.currentIndex];  // 현재 인덱스의 키워드 사용
            addResult({
                keyword: currentKw,
                url: '조회실패',
                lat: '조회실패',
                lng: '조회실패',
                description: '조회실패',
                wikiStatus: 'X'
            });
            window.extractorData.waitingForData = false;
            setTimeout(nextKeyword, 1000);
            return;
        }
        
        // 4. 첫 번째 결과에서 정보 추출
        var firstPlace = data.data.list[0];
        if (!firstPlace) {
            updateStatus('❌ 장소 정보를 찾을 수 없음');
            var currentKw = window.extractorData.keywords[window.extractorData.currentIndex];  // 현재 인덱스의 키워드 사용
            addResult({
                keyword: currentKw,
                url: '조회실패',
                lat: '조회실패',
                lng: '조회실패',
                description: '조회실패',
                wikiStatus: 'X'
            });
            window.extractorData.waitingForData = false;
            setTimeout(nextKeyword, 1000);
            return;
        }
        
        // 5. 데이터 추출 (실제 확인된 필드명 사용)
        var placeId = firstPlace.id || '';
        var lat = firstPlace.lat || '';
        var lng = firstPlace.lng || '';
        
        // 6. URL 생성
        var url = '';
        if (placeId && /^\d{5,15}$/.test(placeId)) {
            url = 'https://map.naver.com/p/entry/place/' + placeId;
        }
        
        // 7. 결과 저장 (위키피디아 설명 추가)
        var currentKw = window.extractorData.keywords[window.extractorData.currentIndex];
        
        // 먼저 기본 결과 추가 (위키 상태는 '-'로)
        addResult({
            keyword: currentKw,
            url: url || '조회실패',
            lat: lat || '조회실패',
            lng: lng || '조회실패',
            description: '',
            wikiStatus: '-'
        });
        
        // 위키피디아 API 호출 (비동기)
        fetchWikipediaDescription(currentKw).then(function(description) {
            // 마지막 결과의 위키 상태 업데이트
            var lastIndex = window.extractorData.results.length - 1;
            window.extractorData.results[lastIndex].description = description;
            window.extractorData.results[lastIndex].wikiStatus = (description && description !== '조회실패') ? 'O' : 'X';
            
            // 테이블 업데이트 (위키 컬럼은 마지막 컬럼)
            var tableBody = document.getElementById('resultTableBody');
            var lastRow = tableBody.rows[tableBody.rows.length - 1];
            if (lastRow) {
                var wikiCell = lastRow.cells[4];
                wikiCell.textContent = window.extractorData.results[lastIndex].wikiStatus;
                // 성공(O)이면 빨간색 제거, 실패(X)면 빨간색 추가
                if (window.extractorData.results[lastIndex].wikiStatus === 'O') {
                    wikiCell.classList.remove('error');
                } else {
                    wikiCell.classList.add('error');
                }
            }
        }).catch(function(error) {
            console.log('위키피디아 검색 실패:', error);
            // 마지막 결과의 위키 상태를 X로 업데이트
            var lastIndex = window.extractorData.results.length - 1;
            window.extractorData.results[lastIndex].description = '조회실패';
            window.extractorData.results[lastIndex].wikiStatus = 'X';
            
            // 테이블 업데이트 (위키 컬럼은 마지막 컬럼)
            var tableBody = document.getElementById('resultTableBody');
            var lastRow = tableBody.rows[tableBody.rows.length - 1];
            if (lastRow) {
                var wikiCell = lastRow.cells[4];
                wikiCell.textContent = 'X';
                wikiCell.classList.add('error');
            }
        });
        
        updateStatus('✅ 성공: ' + (firstPlace.title || '제목없음') + (placeId ? ' (ID: ' + placeId + ')' : ''));
        
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
        
        // 테이블 초기화 및 표시
        var resultTableBody = document.getElementById('resultTableBody');
        resultTableBody.innerHTML = '';
        
        setupMessageListener();
        processCurrentKeyword();
    };

    /* ---------- 키워드 순회 ---------- */
    function processCurrentKeyword() {
        if (window.extractorData.currentIndex >= window.extractorData.keywords.length) { finishExtraction(); return; }
        var kw = window.extractorData.keywords[window.extractorData.currentIndex];
        window.extractorData.currentKeyword = kw;  // 현재 키워드 업데이트
        updateStatus('🔍 검색 중: ' + kw + ' (' + (window.extractorData.currentIndex + 1) + '/' + window.extractorData.keywords.length + ')');
        var kwDiv = document.getElementById('currentKeyword');
        kwDiv.style.display = 'block';
        kwDiv.innerHTML = '📍 현재: <strong>' + kw + '</strong>';
        performSearch(kw);
    }

    /* ---------- 검색 ---------- */
    function performSearch(keyword) {
        var input = document.querySelector('input.input_search');
        if (!input) { 
            addResult({
                keyword: keyword,
                url: '조회실패',
                lat: '조회실패',
                lng: '조회실패',
                description: '조회실패',
                wikiStatus: 'X'
            });
            nextKeyword(); 
            return; 
        }

        window.extractorData.waitingForData = true;
        setReactInputValue(input, keyword);

        setTimeout(function () {
            executeSearch(input);
            /* 10초 안에 메시지 못 받으면 타임아웃 */
            setTimeout(function () {
                if (window.extractorData.waitingForData) {
                    updateStatus('⏰ 타임아웃 - PostMessage 수신 실패');
                    addResult({
                        keyword: keyword,
                        url: '조회실패',
                        lat: '조회실패',
                        lng: '조회실패',
                        description: '조회실패',
                        wikiStatus: 'X'
                    });
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

    /* ---------- 위키피디아 설명 가져오기 ---------- */
    function fetchWikipediaDescription(keyword) {
        return new Promise(function(resolve, reject) {
            var wikiUrl = 'https://ko.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&explaintext=1&exintro=1&titles=' + 
                         encodeURIComponent(keyword) + '&origin=*';
            
            fetch(wikiUrl)
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    var pages = data.query.pages;
                    var pageId = Object.keys(pages)[0];
                    var extract = pages[pageId].extract || '';
                    
                    if (extract && extract.trim()) {
                        // 첫 두 문장만 추출
                        var sentences = extract.split('.');
                        var description = sentences.slice(0, 2).join('.').trim();
                        if (description && !description.endsWith('.')) {
                            description += '.';
                        }
                        resolve(description || '조회실패');
                    } else {
                        resolve('조회실패');
                    }
                })
                .catch(function(error) {
                    console.log('위키피디아 API 오류:', error);
                    resolve('조회실패');
                });
        });
    }

    /* ---------- 결과 추가 ---------- */
    function addResult(resultObj) {
        window.extractorData.results.push(resultObj);
        updateResultOutput();
    }

    function updateResultOutput() {
        var lastResult = window.extractorData.results[window.extractorData.results.length - 1];
        var tableBody = document.getElementById('resultTableBody');
        
        var row = document.createElement('tr');
        
        // 각 셀 생성 및 오류 상태 체크
        var keywordCell = '<td class="keyword" title="' + lastResult.keyword + '">' + lastResult.keyword + '</td>';
        var latCell = '<td class="lat' + (lastResult.lat === '조회실패' ? ' error' : '') + '">' + lastResult.lat + '</td>';
        var lngCell = '<td class="lng' + (lastResult.lng === '조회실패' ? ' error' : '') + '">' + lastResult.lng + '</td>';
        var urlCell = '<td class="url' + (lastResult.url === '조회실패' ? ' error' : '') + '" title="' + lastResult.url + '">' + lastResult.url + '</td>';
        var wikiCell = '<td class="wiki' + ((lastResult.wikiStatus === 'X' || lastResult.wikiStatus === '-') ? ' error' : '') + '">' + (lastResult.wikiStatus || '-') + '</td>';
        
        row.innerHTML = keywordCell + latCell + lngCell + urlCell + wikiCell;
        tableBody.appendChild(row);
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
        var ok = window.extractorData.results.filter(function (r) { return r.url.includes('place'); }).length;
        updateStatus('✅ 키워드 추출 완료! 성공: ' + ok + '/' + window.extractorData.keywords.length);
        alert('추출이 완료되었습니다!\n성공: ' + ok + '/' + window.extractorData.keywords.length + '\n\n결과 복사 버튼을 클릭하세요!');
    }

    /* ---------- 결과 복사 (데이터만) ---------- */
    window.copyResult = function () {
        if (!window.extractorData.results.length) { alert('복사할 결과가 없습니다!'); return; }
        
        // 키워드, 위도, 경도, URL, 위키피디아 설명 순서로 데이터만 복사
        var dataOnly = window.extractorData.results
            .map(function (r) { 
                return r.keyword + '\t' + r.lat + '\t' + r.lng + '\t' + r.url + '\t' + (r.description || '조회실패'); 
            })
            .join('\n');
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(dataOnly).then(
                function () { alert('데이터가 복사되었습니다! (헤더 제외)\n키워드 | 위도 | 경도 | URL | 위키피디아 설명\n\n스프레드시트에 붙여넣으세요.'); },
                function () { fallbackCopy(dataOnly); }
            );
        } else fallbackCopy(dataOnly);

        function fallbackCopy(text) {
            var tmp = document.createElement('textarea');
            tmp.style.position = 'fixed'; tmp.style.opacity = '0';
            tmp.value = text; document.body.appendChild(tmp);
            tmp.select(); document.execCommand('copy');
            document.body.removeChild(tmp);
            alert('데이터가 복사되었습니다! (헤더 제외)\n키워드 | 위도 | 경도 | URL | 위키피디아 설명\n\n스프레드시트에 붙여넣으세요.');
        }
    };

    /* ---------- 초기화 ---------- */
    window.clearResults = function () {
        if (!confirm('모든 결과를 삭제할까요?')) return;
        if (window.extractorData.messageListener)
            window.removeEventListener('message', window.extractorData.messageListener);
        window.extractorData = {
            keywords: [], results: [], currentIndex: 0, isRunning: false,
            messageListener: null, waitingForData: false, currentKeyword: ''
        };
        var resultTableBody = document.getElementById('resultTableBody');
        resultTableBody.innerHTML = '<tr><td colspan="5" class="empty-placeholder">결과가 여기에 표시됩니다...</td></tr>';
        document.getElementById('currentKeyword').style.display = 'none';
        updateStatus('🗑️ 초기화 완료. 새로운 키워드를 입력하세요!');
    };
})();
