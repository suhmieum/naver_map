javascript:(function(){
    /* ===== 네이버 지도 URL + 위도경도 + 설명 추출기 =====
        - [신규] 지명도 추출 가능하게 개선
        - [수정] 네트워크 요청 가로채기 로직을 안정적인 방식으로 복원하여 타임아웃 문제 해결
        - [유지] API 요청 필터링 로직은 유지하여 데이터 오염 문제 방지
    */

    /* ---------- 스타일 (변경 없음) ---------- */
    var style = document.createElement('style');
    style.innerHTML =
        '#placeIdExtractor{position:fixed;top:20px;right:20px;width:580px;background:#fff;border:2px solid #03c75a;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.3);z-index:999999;font-family:sans-serif}' +
        '#placeIdExtractor h3{background:#03c75a;color:#fff;margin:0;padding:0 15px;border-radius:10px 10px 0 0;font-size:16px;display:flex;align-items:center;height:48px;box-sizing:border-box;cursor:move}' +
        '#placeIdExtractor .close{margin-left:auto;width:24px;height:24px;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}' +
        '#placeIdExtractor .content{padding:20px}' +
        '#placeIdExtractor textarea{width:calc(100% - 20px);min-height:120px;border:1px solid #ddd;border-radius:6px;padding:10px;font-family:monospace;font-size:12px;margin:10px 0;resize:vertical;box-sizing:border-box}' +
        '#placeIdExtractor .result-table{width:100%;border-collapse:collapse;margin:0;font-size:10px;background:#fff}' +
        '#placeIdExtractor .result-table th{background:#f0f0f0;padding:8px 4px;border:1px solid #ddd;font-weight:bold;text-align:center}' +
        '#placeIdExtractor .result-table td{padding:6px 4px;border:1px solid #ddd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '#placeIdExtractor .result-table td.keyword{text-align:center;max-width:100px}' +
        '#placeIdExtractor .result-table td.lat, #placeIdExtractor .result-table td.lng{text-align:center;max-width:80px}' +
        '#placeIdExtractor .result-table td.wiki{text-align:center;max-width:50px;font-weight:bold}' +
        '#placeIdExtractor .result-table td.url{max-width:200px;font-size:9px;cursor:pointer}' +
        '#placeIdExtractor .result-table-container{height:200px;overflow-y:auto;border:1px solid #ddd;border-radius:6px;margin:10px 0;background:#fafafa}' +
        '#placeIdExtractor .empty-placeholder{text-align:center;padding:60px 20px;color:#999}' +
        '#placeIdExtractor .error{color:#dc3545;font-weight:bold}' +
        '#placeIdExtractor button{background:#03c75a;color:#fff;border:none;padding:10px 15px;border-radius:6px;cursor:pointer;margin:5px 2px;font-size:14px}' +
        '#placeIdExtractor button:hover{background:#028a4e}' +
        '#placeIdExtractor .status{margin:10px 0;padding:8px;background:#f8f9fa;border-radius:4px;font-size:12px;color:#666}' +
        '#placeIdExtractor .current-keyword{margin:10px 0;padding:8px;background:#e3f2fd;border-radius:4px;font-size:12px;color:#1976d2;font-weight:bold}';
    document.head.appendChild(style);

    /* ---------- UI 생성 (변경 없음) ---------- */
    var extractor = document.createElement('div');
    extractor.id = 'placeIdExtractor';
    extractor.innerHTML = 
        '<h3>🗺️ 네이버 지도 정보 추출기 <button class="close" onclick="document.body.removeChild(document.getElementById(\'placeIdExtractor\'))">&times;</button></h3>' +
        '<div class="content">' +
            '<textarea id="keywordInput" placeholder="키워드를 한 줄에 하나씩 입력하세요.&#10;&#10;예시)&#10;비상교육&#10;정발산&#10;북악터널&#10;서울시립미술관&#10;서울시"></textarea>' +
            '<button onclick="startExtraction()">🚀 추출 시작</button>' +
            '<button onclick="copyResult()">📋 결과 복사</button>' +
            '<button onclick="clearResults()" style="background:#dc3545">🗑️ 초기화</button>' +
            '<div id="currentKeyword" class="current-keyword" style="display:none"></div>' +
            '<div id="status" class="status">키워드를 입력하고 "추출 시작" 버튼을 클릭하세요.</div>' +
            '<div class="result-table-container">' +
                '<table id="resultTable" class="result-table">' +
                    '<thead><tr><th>키워드</th><th>위도</th><th>경도</th><th>URL</th><th>위키</th></tr></thead>' +
                    '<tbody id="resultTableBody"><tr><td colspan="5" class="empty-placeholder">결과가 여기에 표시됩니다...</td></tr></tbody>' +
                '</table>' +
            '</div>' +
        '</div>';
    document.body.appendChild(extractor);

    /* ---------- 드래그 기능 (변경 없음) ---------- */
    var header = extractor.querySelector('h3');
    var isDragging = false;
    var startX, startY, startLeft, startTop;
    header.addEventListener('mousedown', function(e) {
        isDragging = true; startX = e.clientX; startY = e.clientY;
        startLeft = parseInt(window.getComputedStyle(extractor).left, 10);
        startTop = parseInt(window.getComputedStyle(extractor).top, 10);
    });
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        var newLeft = startLeft + e.clientX - startX;
        var newTop = startTop + e.clientY - startY;
        extractor.style.left = Math.max(0, Math.min(newLeft, window.innerWidth - extractor.offsetWidth)) + 'px';
        extractor.style.top = Math.max(0, Math.min(newTop, window.innerHeight - extractor.offsetHeight)) + 'px';
    });
    document.addEventListener('mouseup', function() { isDragging = false; });

    /* ---------- 전역 상태 (변경 없음) ---------- */
    window.extractorData = {
        keywords: [], results: [], currentIndex: 0, isRunning: false,
        waitingForData: false, currentSearchKeyword: '', originalXHR: null, originalOpen: null, originalSend: null,
        isProcessing: false, processedResults: new Set()
    };

    /* ---------- 네트워크 요청 가로채기 (안정화 버전) ---------- */
    function setupNetworkInterceptor() {
        if (!window.extractorData.originalXHR) {
            window.extractorData.originalXHR = window.XMLHttpRequest;
            window.extractorData.originalOpen = window.XMLHttpRequest.prototype.open;
            window.extractorData.originalSend = window.XMLHttpRequest.prototype.send;
            console.log("🔧 Original XHR saved for the first time.");
        }

        const originalOpen = window.extractorData.originalOpen;
        const originalSend = window.extractorData.originalSend;

        window.XMLHttpRequest = function() {
            const xhr = new window.extractorData.originalXHR();
            let requestUrl = '';

            xhr.open = function(method, url) {
                requestUrl = url ? url.toString() : '';
                return originalOpen.apply(this, arguments);
            };

            xhr.send = function() {
                const originalOnReadyStateChange = xhr.onreadystatechange;
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4 && xhr.status === 200 && requestUrl.includes('allSearch')) {
                        try {
                            processCoordinateResponse(requestUrl, xhr.responseText);
                        } catch (e) {
                            console.error('응답 처리 실패:', e);
                        }
                    }
                    if (originalOnReadyStateChange) {
                        originalOnReadyStateChange.apply(this, arguments);
                    }
                };
                return originalSend.apply(this, arguments);
            };
            return xhr;
        };
        // Restore prototype
        window.XMLHttpRequest.prototype = window.extractorData.originalXHR.prototype;
    }

    /* ---------- 좌표 포함 API 응답 처리 (데이터 오염 방지 로직 유지) ---------- */
    function processCoordinateResponse(requestUrl, responseText) {
        var currentKw = window.extractorData.currentSearchKeyword;

        try {
            var urlQuery = new URL(requestUrl, window.location.origin).searchParams.get('query');
            if (!urlQuery || decodeURIComponent(urlQuery) !== currentKw) {
                console.log(`🟡 무관한 API 호출 무시: URL(${decodeURIComponent(urlQuery || '')}) != 대기중(${currentKw})`);
                return;
            }
        } catch (e) {
            console.warn("URL 분석 중 오류 발생, 무시:", e);
            return;
        }
        
        if (!window.extractorData.waitingForData || window.extractorData.isProcessing) {
            console.log('❌ 대기 상태 아니거나 이미 처리 중, 무시');
            return;
        }
        
        if (window.extractorData.processedResults.has(currentKw)) {
            console.log('❌ 이미 처리된 키워드, 무시:', currentKw);
            return;
        }
        
        window.extractorData.isProcessing = true;
        window.extractorData.waitingForData = false;
        window.extractorData.processedResults.add(currentKw);
        console.log('🔒 처리 시작:', currentKw);
        
        try {
            var response = JSON.parse(responseText);
            var places = response?.result?.place?.list;
            
            if (!places || places.length === 0) {
                throw new Error("검색 결과 없음");
            }

            var firstPlace = places[0];
            var lat = parseFloat(firstPlace.y || firstPlace.lat).toFixed(7);
            var lng = parseFloat(firstPlace.x || firstPlace.lng).toFixed(7);
            var placeId = firstPlace.id;
            
            console.log(`🏢 ${currentKw} 좌표 발견:`, lat, lng);

            var url_result;
            var isAddressSearch = /시$|도$|구$|군$|동$|면$|읍$/.test(currentKw);
            if (placeId && /^\d{5,15}$/.test(placeId) && !isAddressSearch) {
                url_result = `https://map.naver.com/p/entry/place/${placeId}`;
            } else {
                url_result = `https://map.naver.com/p/search/${encodeURIComponent(currentKw)}?c=${lng},${lat},15,0,0,0,dh`;
            }
            
            addResult({ keyword: currentKw, url: url_result, lat: lat, lng: lng, description: '', wikiStatus: '-' });
            updateStatus(`✅ 추출 완료: ${currentKw}`);
            
            fetchWikipediaDescription(currentKw).then(description => {
                var lastResult = window.extractorData.results[window.extractorData.results.length - 1];
                if (lastResult.keyword === currentKw) {
                    lastResult.description = description;
                    lastResult.wikiStatus = (description && description !== '조회실패') ? 'O' : 'X';
                    updateResultTable();
                }
            });
            
        } catch (error) {
            console.error(`❌ ${currentKw} 처리 실패:`, error.message);
            addResult({ keyword: currentKw, url: '조회실패', lat: '조회실패', lng: '조회실패', description: '조회실패', wikiStatus: 'X' });
        } finally {
            window.extractorData.isProcessing = false;
            // 다음 키워드 진행은 nextKeyword 함수에서만 관리
        }
    }

    /* ---------- 유틸리티 함수 (변경 없음) ---------- */
    function updateStatus(message) { document.getElementById('status').textContent = message; }
    function setReactInputValue(input, value) {
        var event = new Event('input', { bubbles: true });
        var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, value);
        input.dispatchEvent(event);
    }

    /* ---------- 추출 시작/진행/종료 (변경 없음) ---------- */
    window.startExtraction = function() {
        var ks = document.getElementById('keywordInput').value.trim().split('\n').filter(k => k.trim());
        if (!ks.length) { alert('키워드를 입력하세요!'); return; }

        Object.assign(window.extractorData, { keywords: ks, results: [], currentIndex: 0, isRunning: true, processedResults: new Set() });
        document.getElementById('resultTableBody').innerHTML = '';
        
        setupNetworkInterceptor();
        processCurrentKeyword();
    };

    function processCurrentKeyword() {
        if (!window.extractorData.isRunning || window.extractorData.currentIndex >= window.extractorData.keywords.length) {
            finishExtraction();
            return;
        }
        var kw = window.extractorData.keywords[window.extractorData.currentIndex];
        window.extractorData.currentSearchKeyword = kw;
        updateStatus(`🔍 검색 중: ${kw} (${window.extractorData.currentIndex + 1}/${window.extractorData.keywords.length})`);
        document.getElementById('currentKeyword').textContent = '현재 검색: ' + kw;
        document.getElementById('currentKeyword').style.display = 'block';
        performSearch(kw);
    }

    function performSearch(keyword) {
        var input = document.querySelector('input.input_search');
        if (!input) {
            addResult({ keyword: keyword, url: '검색창 없음', lat: '실패', lng: '실패', wikiStatus: 'X' });
            nextKeyword(); return;
        }

        window.extractorData.waitingForData = true;
        
        setTimeout(() => {
            setReactInputValue(input, keyword);
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        }, 100);
        
        // 타임아웃 핸들러
        var timeoutId = setTimeout(() => {
            if (window.extractorData.waitingForData && window.extractorData.currentSearchKeyword === keyword) {
                console.log(`⏰ 타임아웃: ${keyword}`);
                window.extractorData.processedResults.add(keyword);
                addResult({ keyword: keyword, url: '타임아웃', lat: '타임아웃', lng: '타임아웃', wikiStatus: 'X' });
                nextKeyword();
            }
        }, 10000); // 10초
        
        // 타임아웃 ID 저장
        window.extractorData.timeoutId = timeoutId;
    }
    
    function nextKeyword() {
        if(window.extractorData.timeoutId) clearTimeout(window.extractorData.timeoutId);
        window.extractorData.currentIndex++;
        setTimeout(processCurrentKeyword, 1500); // 키워드 간 간격 1.5초로 조정
    }

    function finishExtraction() {
        if (!window.extractorData.isRunning) return; // 중복 실행 방지
        window.extractorData.isRunning = false;

        document.getElementById('currentKeyword').style.display = 'none';
        var ok = window.extractorData.results.filter(r => !r.url.includes('실패') && !r.url.includes('타임아웃')).length;
        updateStatus(`✅ 추출 완료! 성공: ${ok}/${window.extractorData.keywords.length}`);
        alert(`추출 완료!\n성공: ${ok}/${window.extractorData.keywords.length}`);
    }

    /* ---------- 위키피디아/결과/UI 함수 (변경 없음) ---------- */
    function fetchWikipediaDescription(keyword) {
        return fetch(`https://ko.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&explaintext=1&exintro=1&titles=${encodeURIComponent(keyword)}&origin=*`)
            .then(response => response.json())
            .then(data => {
                var page = Object.values(data.query.pages)[0];
                var extract = page.extract;
                if (!extract) return '조회실패';
                var description = extract.split('.').slice(0, 2).join('.').trim();
                return description + (description.endsWith('.') ? '' : '.');
            }).catch(() => '조회실패');
    }
    function addResult(resultObj) {
        // 이미 처리된 키워드에 대한 결과는 추가하지 않음 (타임아웃과 경합 방지)
        if(window.extractorData.results.some(r => r.keyword === resultObj.keyword)) return;
        
        if(window.extractorData.timeoutId) clearTimeout(window.extractorData.timeoutId);

        window.extractorData.results.push(resultObj);
        updateResultOutput();
        
        // 결과가 추가되면 다음 키워드로 진행
        nextKeyword();
    }
    function updateResultOutput() {
        var result = window.extractorData.results[window.extractorData.results.length - 1];
        if (!result) return;
        var tableBody = document.getElementById('resultTableBody');
        if (tableBody.rows.length === 1 && tableBody.rows[0].cells[0].classList.contains('empty-placeholder')) tableBody.innerHTML = '';
        var row = tableBody.insertRow();
        row.innerHTML = `<td class="keyword">${result.keyword}</td>` +
                        `<td class="lat">${result.lat}</td>` +
                        `<td class="lng">${result.lng}</td>` +
                        `<td class="url" style="cursor:pointer;" onclick="window.open('${result.url}', '_blank')">${result.url}</td>` +
                        `<td class="wiki">${result.wikiStatus}</td>`;
    }
    function updateResultTable() {
        if (window.extractorData.results.length === 0) return;
        var tableBody = document.getElementById('resultTableBody');
        var lastRow = tableBody.rows[tableBody.rows.length - 1];
        if (!lastRow) return;
        var lastResult = window.extractorData.results[window.extractorData.results.length - 1];
        if (!lastResult) return;
        var wikiCell = lastRow.cells[4];
        wikiCell.textContent = lastResult.wikiStatus;
        wikiCell.classList.toggle('error', lastResult.wikiStatus !== 'O');
    }
    window.copyResult = function () {
        if (!window.extractorData.results.length) { alert('복사할 결과가 없습니다!'); return; }
        var textToCopy = window.extractorData.results.map(r => [r.keyword, r.lat, r.lng, r.url, r.description || '조회실패'].join('\t')).join('\n');
        navigator.clipboard.writeText(textToCopy).then(() => alert('데이터가 복사되었습니다.'));
    };
    window.clearResults = function () {
        if (!confirm('모든 결과를 삭제할까요?')) return;
        window.extractorData.isRunning = false;
        if(window.extractorData.timeoutId) clearTimeout(window.extractorData.timeoutId);
        Object.assign(window.extractorData, { keywords: [], results: [], currentIndex: 0, isRunning: false, processedResults: new Set() });
        document.getElementById('resultTableBody').innerHTML = '<tr><td colspan="5" class="empty-placeholder">결과가 여기에 표시됩니다...</td></tr>';
        updateStatus('🗑️ 초기화 완료.');
    };
})();
