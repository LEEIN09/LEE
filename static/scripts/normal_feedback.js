// public/scripts/normalModeFeedback.js

const Chart = window.Chart;
const FaceMesh = window.FaceMesh;

const MAX_CHANGES = { "전두근": 0.136, "안륜근": 0.047, "추미근": 0.072, "상순비익거근": 0.143, "대관골근": 0.048, "익돌근": 0.09, "상순절치근": 0.017, "협근": 0.017 };
const MUSCLE_TO_ACTION = { "전두근": "눈썹 올리기", "안륜근": "눈 강하게 감기", "추미근": "미간 조이기", "상순비익거근": "찡그리기", "대관골근": "입꼬리 올리기", "익돌근": "입 벌리기", "상순절치근": "입술 오므리기", "협근": "보조개 만들기" };
const MUSCLE_RULES = { "전두근": { points: [334, 386], direction: "increase" }, "안륜근": { points: [386, 374], direction: "decrease" }, "추미근": { points: [107, 336], direction: "decrease" }, "상순비익거근": { points: [285, 437], direction: "decrease" }, "대관골근": { points: [291, 446], direction: "decrease" }, "익돌근": { points: [1, 152], direction: "increase" }, "상순절치근": { points: [61, 291], direction: "decrease" }, "협근": { points: [61, 291], direction: "increase", stable: [13, 14] } };
const pieColors = ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#CCCCCC", "#FF9F40", "#C9CBCF"];
const NORMAL_MODE_TOTAL_ROUNDS = 10;
let faceMeshInstance = null;

async function setupFaceMesh() {
    if (!faceMeshInstance) {
        faceMeshInstance = new FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
        faceMeshInstance.setOptions({ staticImageMode: true, refineLandmarks: true, maxNumFaces: 1, minDetectionConfidence: 0.5 });
        await faceMeshInstance.initialize();
    }
}

async function extractLandmarks(src) {
    await setupFaceMesh();
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = src;
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            faceMeshInstance.onResults(results => {
                if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) resolve(null);
                else resolve(results.multiFaceLandmarks[0].map(pt => [pt.x, pt.y]));
            });
            faceMeshInstance.send({ image: canvas });
        };
        img.onerror = reject;
    });
}

async function extractLandmarksFromImages(imageList) {
    const results = [];
    for (let src of imageList) {
        try {
            results.push(await extractLandmarks(src));
        } catch (error) {
            console.error(`Landmark extraction error for ${src}:`, error);
            results.push(null);
        }
    }
    return results;
}

function computeDist(landmarks, [i1, i2]) {
    if (!landmarks || !landmarks[i1] || !landmarks[i2]) return 0;
    return Math.sqrt((landmarks[i1][0] - landmarks[i2][0]) ** 2 + (landmarks[i1][1] - landmarks[i2][1]) ** 2);
}

function evaluateRoundScores(refLandmarks, userLandmarks) {
    const scores = [];
    const numRounds = Math.min(refLandmarks.length - 1, userLandmarks.length - 1);
    for (let i = 1; i <= numRounds; i++) {
        if (!refLandmarks[i] || !userLandmarks[i]) { scores.push(null); continue; }
        const muscleScores = [];
        for (let muscle in MUSCLE_RULES) {
            const rule = MUSCLE_RULES[muscle];
            const maxChange = MAX_CHANGES[muscle] || 1;
            const refDiff = computeDist(refLandmarks[i], rule.points) - computeDist(refLandmarks[0], rule.points);
            const userDiff = computeDist(userLandmarks[i], rule.points) - computeDist(userLandmarks[0], rule.points);
            const refRatio = Math.abs(refDiff) / maxChange;
            const userRatio = Math.abs(userDiff) / maxChange;
            let score = 0;
            if (Math.sign(refDiff) === Math.sign(userDiff)) {
                score = 1 - Math.abs(refRatio - userRatio);
            }
            muscleScores.push(Math.max(0, Math.min(1, score)));
        }
        scores.push(muscleScores.reduce((a, b) => a + b, 0) / muscleScores.length);
    }
    return scores;
}

function calculateClientSideMuscleAnalysis(userLandmarks) {
    if (!userLandmarks || !userLandmarks[0]) return { topMusclesFull: [], activatedMusclesList: [] };
    const topMusclesFull = Object.entries(MUSCLE_RULES).map(([muscle, rule]) => {
        let totalNormalizedDiff = 0, activationCount = 0;
        for (let i = 1; i < userLandmarks.length; i++) {
            if (!userLandmarks[i]) continue;
            const diff = computeDist(userLandmarks[i], rule.points) - computeDist(userLandmarks[0], rule.points);
            let activated = (rule.direction === "increase" && diff > 0.005) || (rule.direction === "decrease" && diff < -0.005);
            if (activated) {
                totalNormalizedDiff += Math.abs(diff) / (MAX_CHANGES[muscle] || 1);
                activationCount++;
            }
        }
        return { expr: muscle, usage: activationCount > 0 ? totalNormalizedDiff / activationCount : 0 };
    }).sort((a, b) => b.usage - a.usage);
    const activatedMusclesList = topMusclesFull.filter(m => m.usage > 0).map(m => ({ muscle: m.expr, action: MUSCLE_TO_ACTION[m.expr] || "-" }));
    return { topMusclesFull, activatedMusclesList };
}

function renderBarChart(values, totalRounds) {
    const ctx = document.getElementById("chart").getContext("2d");
    const labels = Array.from({ length: totalRounds }, (_, i) => `라운드 ${i + 1}`);
    const dataValues = values.map(v => (v === null || v === undefined) ? 0 : Math.round(v * 100));
    if (window.myBarChart) window.myBarChart.destroy();
    window.myBarChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels.slice(0, dataValues.length),
            datasets: [{
                label: "일치율 (%)",
                data: dataValues,
                backgroundColor: "rgba(54, 162, 235, 0.5)",
                borderColor: "rgba(54, 162, 235, 1)",
                borderWidth: 1
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
    });
}

function generateSummaryFeedback(avgScore, usedMusclesCount) {
    const lines = ["오늘도 얼굴 운동 하느라 수고 많았어요! 😊"];
    if (usedMusclesCount >= 5) lines.push("다양한 근육들을 골고루 사용하셨습니다. 👏");
    else if (usedMusclesCount > 0) lines.push("몇 가지 주요 근육을 잘 사용하셨어요. 다음엔 더 다양하게 도전해봐요! 💪");
    else lines.push("앗, 근육 사용이 감지되지 않았어요. 다음에는 선생님 표정을 조금 더 적극적으로 따라해볼까요? 😉");
    if (avgScore >= 0.7) lines.push("선생님의 사진을 매우 잘 따라했습니다. 👍");
    else if (avgScore >= 0.4) lines.push("선생님 표정을 잘 따라하려고 노력하셨네요! 조금만 더 힘내봐요! 😊");
    else lines.push("괜찮아요! 처음엔 어려울 수 있어요. 꾸준히 연습하면 분명 좋아질 거예요. 😊");
    lines.push("항상 스마일핏과 함께 즐겁고 활기찬 운동 되시길 바랍니다! 🌟");
    return lines.join("<br><br>");
}

function populateActivatedMusclesList(listData) {
    const listElement = document.getElementById("top-expression-list");
    listElement.innerHTML = "";
    if (!listData || listData.length === 0) { listElement.innerHTML = "<li>사용한 근육이 없습니다.</li>"; return; }
    listData.forEach(item => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${item.muscle}</strong> – ${item.action}`;
        listElement.appendChild(li);
    });
}

function renderPieChartWithLabels(dataForPie) {
    const pieChartContainer = document.getElementById("pie-chart-container");
    const validMuscles = dataForPie.filter(m => m.usage > 0);
    if (validMuscles.length === 0) { pieChartContainer.innerHTML = "<p>분석된 근육 사용량 데이터가 없습니다.</p>"; return; }
    const totalUsage = validMuscles.reduce((sum, m) => sum + m.usage, 0);
    if (totalUsage === 0) { pieChartContainer.innerHTML = "<p>계산된 근육 사용량이 없습니다.</p>"; return; }
    const top5Muscles = validMuscles.slice(0, 5);
    const pieDataValues = top5Muscles.map(m => parseFloat(((m.usage / totalUsage) * 100).toFixed(1)));
    const pieLabelTexts = top5Muscles.map(m => m.expr);
    const pieCtx = document.getElementById("topMusclePieChart").getContext("2d");
    if (window.myPieChart) window.myPieChart.destroy();
    window.myPieChart = new Chart(pieCtx, {
        type: "pie",
        data: { labels: pieLabelTexts, datasets: [{ data: pieDataValues, backgroundColor: pieColors }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    const labelContainer = document.getElementById("pie-labels");
    labelContainer.innerHTML = "";
    pieLabelTexts.forEach((label, i) => {
        const li = document.createElement("li");
        li.style.cssText = "display: flex; align-items: center; margin-bottom: 8px;";
        li.innerHTML = `<span style="display:inline-block; width:12px; height:12px; background-color:${pieColors[i]}; margin-right:8px;"></span><strong>${label}</strong><span style="margin-left:auto; font-size:14px; color:#555;">${pieDataValues[i]}%</span>`;
        labelContainer.appendChild(li);
    });
}

export async function init() {
    document.body.classList.add('loaded');
    const loadingMessageDiv = document.getElementById('loading-message');
    const reportDiv = document.getElementById('report');
    const summaryTextDiv = document.getElementById('summary-text');

    try {
        document.getElementById('report-mode-name').textContent = "일반 운동";
        document.getElementById('report-date').textContent = new Date().toLocaleDateString('ko-KR');

        const teacher = sessionStorage.getItem('selectedTeacher');
        const userNeutralSrc = sessionStorage.getItem("neutralImage");
        const userImageSrcs = JSON.parse(sessionStorage.getItem("capturedImages") || "[]");

        if (!teacher || !userNeutralSrc || userImageSrcs.length === 0) {
            throw new Error("분석에 필요한 데이터(선생님 또는 사용자 이미지)가 없습니다. 운동을 다시 진행해주세요.");
        }

        const userAllSrcs = [userNeutralSrc, ...userImageSrcs];
        const refImagePaths = [`/static/images/teachers/${teacher}/neutral.png`];
        for (let i = 1; i <= NORMAL_MODE_TOTAL_ROUNDS; i++) {
            refImagePaths.push(`/static/images/teachers/${teacher}/${teacher}${i}.png`);
        }

        document.getElementById("reference-images-title").textContent = `기준 사진 (${NORMAL_MODE_TOTAL_ROUNDS}장)`;
        const refContainer = document.getElementById("reference-images");
        refContainer.innerHTML = '';
        refImagePaths.slice(1).forEach(src => { const img = document.createElement("img"); img.src = src; refContainer.appendChild(img); });
        
        document.getElementById("user-images-title").textContent = `사용자 사진 (${userImageSrcs.length}장)`;
        const userContainer = document.getElementById("user-images");
        userContainer.innerHTML = '';
        userImageSrcs.forEach(src => { const img = document.createElement("img"); img.src = src; userContainer.appendChild(img); });

        const refLandmarks = await extractLandmarksFromImages(refImagePaths);
        const userLandmarks = await extractLandmarksFromImages(userAllSrcs);

        if (!refLandmarks[0] || !userLandmarks[0]) {
            throw new Error("중립 표정 이미지의 얼굴을 인식할 수 없어 분석을 진행할 수 없습니다.");
        }

        const similarityScores = evaluateRoundScores(refLandmarks, userLandmarks);
        renderBarChart(similarityScores, NORMAL_MODE_TOTAL_ROUNDS);

        const { topMusclesFull, activatedMusclesList } = calculateClientSideMuscleAnalysis(userLandmarks);
        renderPieChartWithLabels(topMusclesFull);
        populateActivatedMusclesList(activatedMusclesList);

        const validScores = similarityScores.filter(s => s !== null);
        const avgScore = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : 0;
        summaryTextDiv.innerHTML = generateSummaryFeedback(avgScore, topMusclesFull.filter(m => m.usage > 0).length);

    } catch (err) {
        console.error("일반 모드 분석 오류:", err);
        summaryTextDiv.innerHTML = `<strong style="color:red;">오류:</strong> ${err.message}`;
    } finally {
        loadingMessageDiv.style.display = 'none';
        reportDiv.style.display = 'block';
    }
}