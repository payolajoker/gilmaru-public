import csv

# 엄격한 부정적 단어 필터 (어간만)
NEGATIVE_STEMS = {
    # 감정적으로 부정적인 단어
    '괴롭', '귀찮', '나쁘', '낯설', '둔하', '더럽', '밉', '무섭', '부끄럽',
    '불행하', '불편하', '서투르', '슬프', '시끄럽', '싫', '심심하', '아깝',
    '아프', '안타깝', '어둡', '어렵', '억울하', '외롭', '우울하', '위험하',
    '지루하', '피곤하', '힘들', '지저분하', '초라하', '답답하', '걱정',
   ' 미안하', '실망하', '짜증', '속상하', '창피하', '고프', '배고프',
    '무겁', '못하', '부족하', '틀리', '막히', '복잡하', '비싸', '졸리',
    '재미없', '가난하', '가렵', '가련', '가증', '가당찮', '가소롭', '각박',
    '간교', '간사', '간악', '간흉', '갑갑', '강팍', '개탄', '거만', '거북',
    '건방', '경망', '경박', '계면', '고달프', '고되', '고롭', '고약', '곤경',
    '곤궁', '곤하', '곤혹', '당황', '대수롭잖', '덜되', '덜떨어지', '뚱뚱하',
    '모자라', '목마르', '몰라보', '못나', '못되', '못생기', '무덥', '무디',
    '미덥잖', '미숙하', '미치', '밉상', '박하', '반galp잖', '버거롭', '부끄러워',
    '부담', '부러워', '불가능하', '불결하', '불길하', '불량하', '불쌍하',
    '불안하', '불온하', '불친절하', '뻔뻔', '살벌하', '서운하', '서툴',
    '섭섭하', '소심하', '속상', '수상쩍', '수상하', '수줍', '슬기롭잖',
    '시시하', '시원찮', '신통찮', '실없', '심각하', '싫증', '쌀쌀하',
    '쌩뚱맞', '썩', '악랄하', '안쓰럽', '애처롭', '약삭빠르', '어둑하',
    '어두컴컴하', '어리석', '어리숙하', '어색하', '엄격하', '엄하', '엉성하',
    '열악하', '오만하', '외로워', '욕심많', '우습', '원통하', '유감',
    '음습하', '음침하', '의아하', '의심', '이기적', '인색하', '잔인하',
    '질기', '짜증', '쩨쩨하', '찌푸리', '참담하', '처량하', '추하', '치사하',
    '치졸하', '칙칙하', '침울하', '캄캄하', '케케묵', '탁하', '터무니없',
    '허무하', '허술하', '허탈하', '혼란', '황당하', '후회', '흉하', '힘겹',
    '게으르', '게을르', '게걸', '개으르'
}

# 사용하기 어려운 패턴
EXCLUDED_PATTERNS = [
    'ㅣ', 'ㅡ', 'ㅏ', 'ㅓ', 'ㅗ', 'ㅜ',  # 자모음만 있는 경우
    '디가', '디높', '디크', '디작', '디길', '디좁', '디짧',  # 반복 패턴
    '하잖', '지않', '스럽잖', '롭잖', '답잖', '갑잖',  # 부정형
    '스스럽', '스레', '쩍', '적', '데없', '곳없', '뜨없'  # 복잡한 접미사
]

def is_clean_adjective(word):
    """깨끗하고 사용하기 좋은 형용사인지 판단"""
    # '다' 제거
    if not word.endswith('다'):
        return False
    
    stem = word[:-1]
    
    # 너무 짧거나 긴 단어
    if len(stem) < 2 or len(stem) > 4:
        return False
    
    # 부정적 어간 체크
    for neg in NEGATIVE_STEMS:
        if neg in stem:
            return False
    
    # 제외 패턴 체크
    for pattern in EXCLUDED_PATTERNS:
        if pattern in stem:
            return False
    
    # 한글만 포함 (특수문자 제외)
    if not stem.replace(' ', '').isalpha():
        return False
    
    # 한글이 아닌 문자 체크
    for char in stem:
        if not ('가' <= char <= '힣'):  # 한글 음절만
            return False
    
    return True

def prioritize_adjectives(adjectives):
    """사용하기 좋은 순서로 정렬"""
    # 길이가 짧고 간단한 것 우선
    return sorted(adjectives, key=lambda x: (len(x), x))

def main():
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    
    input_file = 'mecab_positive_adjectives.txt'
    
    # 파일 읽기
    with open(input_file, 'r', encoding='utf-8') as f:
        all_adj = [line.strip() for line in f if line.strip()]
    
    print(f"Total from mecab: {len(all_adj)}")
    
    # 깨끗한 형용사만 필터링
    clean_adj = [w for w in all_adj if is_clean_adjective(w)]
    print(f"After cleaning: {len(clean_adj)}")
    
    # 우선순위로 정렬
    prioritized = prioritize_adjectives(clean_adj)
    
    # 상위 200개 선택 (사용자가 골라볼 수 있도록)
    top_200 = prioritized[:200]
    
    print(f"\nTop 200 clean adjectives:")
    print(f"First 50: {', '.join(top_200[:50])}")
    
    # 저장
    with open('clean_adjectives_top200.txt', 'w', encoding='utf-8') as f:
        f.write('\n'.join(top_200))
    
    print(f"\nSaved to: clean_adjectives_top200.txt")

if __name__ == "__main__":
    main()
