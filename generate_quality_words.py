"""
품질 개선: TOPIK 어휘 우선 + mecab 보충 전략
"""

import csv
import random

# 부정적 단어
NEGATIVE = {
    '고통', '괴로', '슬픔', '아픔', '비통', '한탄', '절망', '좌절', '분노', '증오',
    '질투', '시기', '원망', '미움', '혐오', '걱정', '근심', '불안', '공포', '두려',
    '실망', '낙담', '패배', '포기', '부끄', '수치', '창피', '가난', '빈곤', '병',
    '죽음', '사망', '전쟁', '폭력', '범죄', '거짓'
}

# 카테고리 정의 (엄격한 키워드)
CATEGORIES = {
    'A': ['행복', '기쁨', '웃음', '미소', '사랑', '희망', '꿈', '소망', '평화', '용기', '열정', '자유', '믿음'],
    'B': ['하늘', '별', '달', '해', '햇', '바람', '비', '눈', '구름', '산', '강', '바다', '나무', '꽃', '풀', '봄', '여', '가을', '겨울'],
    'C': ['과', '배', '사과', '책', '연필', '집', '방', '문', '공', '의자', '옷', '모자', '공책', '가방'],
    'D': ['시간', '순간', '오늘', '내일', '어제', '아침', '저녁', '밤', '여행', '추억', '이야기', '역사', '문화']
}

def is_good_word(word):
    """좋은 단어인지 판단"""
    # 부정적 단어 제외
    for neg in NEGATIVE:
        if neg in word:
            return False
    
    # 너무 길거나 짧은 단어 제외
    if len(word) < 2 or len(word) > 4:
        return False
    
    # 한글만 포함
    if not all('가' <= ch <= '힣' for ch in word):
        return False
    
    return True

def load_topik_nouns():
    """TOPIK 어휘에서 명사만"""
    nouns = {
        'A': [],
        'B': [],
        'C': [],
        'D': []
    }
    
    try:
        with open('topik_vocabulary_combined.csv', 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            reader.fieldnames = [n.strip() for n in reader.fieldnames]
            
            for row in reader:
                word = row['korean']
                
                # 명사만 (다로 끝나지 않음)
                if word.endswith('다'):
                    continue
                
                if not is_good_word(word):
                    continue
                
                # 카테고리 분류
                categorized = False
                for cat, keywords in CATEGORIES.items():
                    for kw in keywords:
                        if kw in word:
                            nouns[cat].append(word)
                            categorized = True
                            break
                    if categorized:
                        break
                
                # 분류 안된 건 C(사물)로
                if not categorized:
                    nouns['C'].append(word)
    
    except Exception as e:
        print(f"TOPIK 로드 실패: {e}")
    
    return nouns

def fill_from_mecab(nouns, targets):
    """mecab에서 부족한 부분 채우기"""
    mecab_words = {
        'A': [],
        'B': [],
        'C': [],
        'D': []
    }
    
    try:
        with open('mecab_nng.csv', 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            for row in reader:
                if not row:
                    continue
                
                word = row[0].strip()
                
                if not is_good_word(word):
                    continue
                
                # 카테고리 분류
                for cat, keywords in CATEGORIES.items():
                    if any(kw in word for kw in keywords):
                        mecab_words[cat].append(word)
                        break
                else:
                    mecab_words['C'].append(word)
    
    except Exception as e:
        print(f"mecab 로드 실패: {e}")
    
    # 부족한 부분만 보충
    result = {}
    for cat in ['A', 'B', 'C', 'D']:
        topik_words = list(set(nouns[cat]))
        mecab_extra = list(set(mecab_words[cat]))
        random.shuffle(mecab_extra)
        
        target = targets[cat]
        
        if len(topik_words) >= target:
            result[cat] = sorted(topik_words[:target])
        else:
            # TOPIK + mecab 보충
            needed = target - len(topik_words)
            extra = [w for w in mecab_extra if w not in topik_words][:needed]
            result[cat] = sorted(topik_words + extra)
        
        print(f"word{cat}: TOPIK {len(topik_words)}개 + mecab {len(result[cat])-len(topik_words)}개 = {len(result[cat])}개")
    
    return result

if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    
    print("=" * 60)
    print("TOPIK 우선 + mecab 보충 전략")
    print("=" * 60)
    
    # 1. TOPIK에서 명사 추출
    print("\n[1] TOPIK 어휘에서 명사 추출 중...")
    topik_nouns = load_topik_nouns()
    
    # 2. mecab으로 부족한 부분 채우기
    print("\n[2] mecab으로 부족한 부분 보충 중...")
    targets = {'A': 146, 'B': 112, 'C': 500, 'D': 500}
    final_words = fill_from_mecab(topik_nouns, targets)
    
    # 3. 저장
    print("\n" + "=" * 60)
    print("최종 결과")
    print("=" * 60)
    
    for cat in ['A', 'B', 'C', 'D']:
        words = final_words[cat]
        print(f"\nword{cat}: {len(words)}개")
        print(f"  처음 20개: {', '.join(words[:20])}")
        
        filename = f'word{cat}_final.txt'
        with open(filename, 'w', encoding='utf-8') as f:
            f.write('\n'.join(words))
        print(f"  ✅ 저장: {filename}")
    
    print("\n완료!")
