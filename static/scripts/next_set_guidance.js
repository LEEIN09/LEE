// static/scripts/next_set_guidance.js

// 페이지 로더가 호출할 수 있도록 init 함수로 감싸고 export 합니다.
export function init() {
    // 페이지 이동 시 fade-out 효과를 주는 함수
    function delayedNav(url) {
        document.body.classList.remove('loaded');
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = url;
        }, 400);
    }

    // 페이지가 로드되면 바로 실행
    document.body.classList.add('loaded');

    // 1. URL에서 파라미터 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const teacherId = urlParams.get('teacher_id');
    const nextSetNumber = urlParams.get('current_set');

    // 2. 화면에 다음 세트 번호 표시
    const setDisplayElement = document.getElementById('next-set-display');
    if (setDisplayElement) {
        setDisplayElement.textContent = nextSetNumber;
    }

    // 3. 버튼에 클릭 이벤트 추가
    const nextSetButton = document.getElementById('next-set-btn');
    if (nextSetButton) {
        const nextPageUrl = `/pages/complex_fit.html?mode=au&teacher_id=${teacherId}&current_set=${nextSetNumber}`;
        nextSetButton.addEventListener('click', () => {
            delayedNav(nextPageUrl);
        });
    }
}