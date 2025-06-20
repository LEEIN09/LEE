# gemini_helper.py

import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv() # .env 파일에서 환경 변수를 로드

# GOOGLE_API_KEY 환경 변수에서 API 키를 가져옵니다.
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY') 

if not GOOGLE_API_KEY:
    print("경고: GOOGLE_API_KEY 환경 변수가 설정되지 않았습니다. Gemini 기능이 작동하지 않을 수 있습니다.")
    # 실제 프로덕션 환경에서는 sys.exit(1) 등으로 앱 종료 고려
else:
    genai.configure(api_key=GOOGLE_API_KEY)
    print("[Gemini Helper] Gemini API 설정 완료.")

def get_gemini_feedback(user_score: float, user_au_data: dict, teacher_au_data: dict, feature_cols: list) -> str:
    """
    Gemini API를 호출하여 사용자 표정 AU 데이터에 대한 피드백을 생성합니다.

    Args:
        user_score (float): 사용자의 유사도 점수.
        user_au_data (dict): 사용자의 정규화된 AU 특징 딕셔너리.
        teacher_au_data (dict): 선생님의 정규화된 AU 특징 딕셔너리.
        feature_cols (list): AU 특징 컬럼 이름 목록 (참고용).

    Returns:
        str: Gemini가 생성한 피드백 텍스트. 오류 발생 시 상세 메시지 반환.
    """
    try:
        # !!! 이 부분을 ListModels로 확인한 정확한 모델 이름으로 수정해야 합니다. !!!
        # 예시: 'gemini-1.0-pro' 또는 'models/gemini-1.0-pro'
        # ListModels 출력에서 'models/' 접두사가 붙어 있다면 포함해서 사용하세요.
        model = genai.GenerativeModel('models/gemini-1.5-pro-latest') # <-- 이 부분을 확인하여 수정하세요! 
        # 만약 'gemini-1.0-pro'도 안 되면 아래의 'gemini-1.5-pro-latest'도 시도해 보세요.
        # model = genai.GenerativeModel('gemini-1.5-pro-latest')
        # 또는 ListModels로 확인된 다른 적절한 모델 이름

        prompt_text = f"""
당신은 AI 표정 코치입니다. 사용자의 표정 AU 데이터와 선생님의 기준 AU 데이터를 바탕으로, 유사도 점수에 대한 상세한 피드백을 생성해주세요.
피드백은 다음 항목들을 포함해야 합니다:
1. 전반적인 유사도 점수에 대한 평가.
2. 어떤 AU(Action Unit)가 선생님과 잘 맞았는지 구체적인 칭찬.
3. 어떤 AU가 선생님과 차이가 있었는지 구체적으로 지적하고 (예: AU04가 선생님보다 낮습니다.), 그 AU를 개선하기 위한 간단하고 실행 가능한 표정 조언 (예: "눈썹을 좀 더 이완시켜 보세요" 또는 "입꼬리를 조금 더 들어 올리는 연습을 해보세요").
4. 다음 연습에 대한 격려나 방향성 제시.

답변은 한국어로 제공하고, 자연스러운 대화체로 3~5문장 정도로 간결하게 요약해주세요.

예시 답변 형식:
"이번 라운드 점수는 [점수]점으로 아주 좋았어요! 특히 [잘된 AU]은 선생님과 거의 똑같았어요. 다만, [개선할 AU]에서 약간 차이가 있었는데, [개선 조언] 연습을 해보면 좋을 거예요. 다음 라운드도 화이팅!"

---
유사도 점수: {user_score:.2f}
사용자 AU 데이터: {user_au_data}
선생님 기준 AU 데이터: {teacher_au_data}
(참고용) 비교된 AU 항목: {feature_cols}
---
"""
        
        response = model.generate_content(prompt_text)
        return response.text

    except Exception as e:
        print(f"[Gemini Helper] 피드백 생성 중 오류 발생: {e}")
        # 오류 메시지를 좀 더 구체적으로 반환하도록 변경 (디버깅에 도움)
        return f"표정 피드백 생성에 문제가 발생했습니다. 오류 상세: {e}. 다시 시도해 주세요."

# 테스트 및 모델 목록 확인을 위한 코드 (app.py 실행 시에는 이 부분이 실행되지 않음)
if __name__ == '__main__':
    # 이 파일을 직접 실행했을 때만 이 코드가 실행됩니다.
    # 즉, 터미널에서 `python gemini_helper.py`를 실행했을 때.
    
    print("\n--- 현재 환경에서 사용 가능한 Gemini 모델 목록 (generateContent 지원) ---")
    try:
        for m in genai.list_models():
            if "generateContent" in m.supported_generation_methods:
                print(f"모델 이름: {m.name}, 지원 메서드: {m.supported_generation_methods}")
    except Exception as e:
        print(f"모델 목록을 가져오는 중 오류 발생: {e}. API 키와 네트워크 연결을 확인하세요.")
    print("--------------------------------------------------------------------\n")

    # 아래는 get_gemini_feedback 함수 테스트를 위한 임시 코드 (실제 앱에서는 필요 없음)
    # 필요한 경우 주석을 해제하고 테스트 데이터를 넣어 실행해 볼 수 있습니다.
    # sample_user_au = {
    #     "AU01": 0.1, "AU02": 0.05, "AU04": 0.8, "AU05": 0.0, "AU06": 0.9,
    #     "AU07": 0.7, "AU09": 0.0, "AU10": 0.5, "AU11": 0.0, "AU12": 0.85,
    #     "AU14": 0.1, "AU15": 0.0, "AU17": 0.0, "AU20": 0.0, "AU23": 0.0,
    #     "AU24": 0.0, "AU25": 0.0, "AU26": 0.0, "AU28": 0.0, "AU43": 0.0,
    #     "AU01_w": 0.08, "AU02_w": 0.04, "AU04_w": 0.64, "AU05_w": 0.0, "AU06_w": 0.72,
    #     "AU07_w": 0.56, "AU09_w": 0.0, "AU10_w": 0.4, "AU11_w": 0.0, "AU12_w": 0.68,
    #     "AU14_w": 0.08, "AU15_w": 0.0, "AU17_w": 0.0, "AU20_w": 0.0, "AU23_w": 0.0,
    #     "AU24_w": 0.0, "AU25_w": 0.0, "AU26_w": 0.0, "AU28_w": 0.0, "AU43_w": 0.0
    # }
    # sample_teacher_au = {
    #     "AU01": 0.05, "AU02": 0.02, "AU04": 0.1, "AU05": 0.0, "AU06": 0.95,
    #     "AU07": 0.6, "AU09": 0.0, "AU10": 0.6, "AU11": 0.0, "AU12": 0.92,
    #     "AU14": 0.05, "AU15": 0.0, "AU17": 0.0, "AU20": 0.0, "AU23": 0.0,
    #     "AU24": 0.0, "AU25": 0.0, "AU26": 0.0, "AU28": 0.0, "AU43": 0.0,
    #     "AU01_w": 0.04, "AU02_w": 0.016, "AU04_w": 0.08, "AU05_w": 0.0, "AU06_w": 0.76,
    #     "AU07_w": 0.48, "AU09_w": 0.0, "AU10_w": 0.48, "AU11_w": 0.0, "AU12_w": 0.736,
    #     "AU14_w": 0.04, "AU15_w": 0.0, "AU17_w": 0.0, "AU20_w": 0.0, "AU23_w": 0.0,
    #     "AU24_w": 0.0, "AU25_w": 0.0, "AU26_w": 0.0, "AU28_w": 0.0, "AU43_w": 0.0
    # }
    # sample_feature_cols = [
    #     "AU01", "AU02", "AU04", "AU05", "AU06", "AU07", "AU09", "AU10",
    #     "AU11", "AU12", "AU14", "AU15", "AU17", "AU20", "AU23", "AU24",
    #     "AU25", "AU26", "AU28", "AU43", 
    #     "AU01_w", "AU02_w", "AU04_w", "AU05_w", "AU06_w", "AU07_w", "AU09_w", "AU10_w",
    #     "AU11_w", "AU12_w", "AU14_w", "AU15_w", "AU17_w", "AU20_w", "AU23_w", "AU24_w",
    #     "AU25_w", "AU26_w", "AU28_w", "AU43_w"
    # ]
    
    # test_feedback = get_gemini_feedback(85.5, sample_user_au, sample_teacher_au, sample_feature_cols)
    # print("\n--- 테스트 피드백 결과 ---")
    # print(test_feedback)