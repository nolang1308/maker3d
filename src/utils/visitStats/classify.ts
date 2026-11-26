// 방문 통계에 쓰는 순수 계산: 접속 경로 판별, 주소 정리, 날짜 키.
// 브라우저 · Firebase 에 기대지 않아서 관리자 화면(광고 링크 만들기)과 시험에서도 그대로 쓴다

export const STATS_COLLECTION = 'siteStats';
/** 이 시간 넘게 움직임이 없다가 다시 오면 새 방문으로 센다 */
export const SESSION_GAP_MS = 30 * 60 * 1000;

export type ChannelGroup = 'search' | 'ad' | 'social' | 'direct' | 'etc';

export const GROUP_LABELS: Record<ChannelGroup, string> = {
  search: '검색',
  ad: '광고',
  social: 'SNS · 커뮤니티',
  direct: '직접 접속',
  etc: '기타',
};

interface ChannelInfo {
  label: string;
  group: ChannelGroup;
}

// 접속 경로의 저장 이름 → 화면에 보일 이름. 저장 이름은 한 번 쌓이기 시작하면 바꾸지 않는다
const CHANNELS: Record<string, ChannelInfo> = {
  naver_ad: { label: '네이버 광고', group: 'ad' },
  google_ad: { label: '구글 광고', group: 'ad' },
  instagram_ad: { label: '인스타 광고', group: 'ad' },
  facebook_ad: { label: '페이스북 광고', group: 'ad' },
  meta_ad: { label: '메타 광고(인스타 · 페이스북)', group: 'ad' },
  kakao_ad: { label: '카카오 광고', group: 'ad' },
  youtube_ad: { label: '유튜브 광고', group: 'ad' },
  naver_search: { label: '네이버 검색', group: 'search' },
  google_search: { label: '구글 검색', group: 'search' },
  daum_search: { label: '다음 검색', group: 'search' },
  search_etc: { label: '기타 검색', group: 'search' },
  instagram: { label: '인스타그램', group: 'social' },
  facebook: { label: '페이스북', group: 'social' },
  meta: { label: '인스타 · 페이스북(구분 안 됨)', group: 'social' },
  kakao: { label: '카카오톡', group: 'social' },
  youtube: { label: '유튜브', group: 'social' },
  naver_blog: { label: '네이버 블로그', group: 'social' },
  naver_cafe: { label: '네이버 카페', group: 'social' },
  naver_shop: { label: '네이버 쇼핑 · 스마트스토어', group: 'etc' },
  naver_etc: { label: '네이버 기타', group: 'etc' },
  referral: { label: '기타 사이트', group: 'etc' },
  direct: { label: '직접 접속', group: 'direct' },
};

const CUSTOM_PREFIX = 'utm:';
const CUSTOM_AD_SUFFIX = '+ad';

/** 저장 이름으로 화면에 보일 이름과 묶음을 찾는다. 직접 정한 꼬리표(utm:전단지)는 그 이름을 그대로 보여 준다 */
export function channelInfo(key: string): ChannelInfo {
  const known = CHANNELS[key];
  if (known) return known;
  if (key.startsWith(CUSTOM_PREFIX)) {
    const paid = key.endsWith(CUSTOM_AD_SUFFIX);
    const name = key.slice(CUSTOM_PREFIX.length, paid ? -CUSTOM_AD_SUFFIX.length : undefined);
    return { label: paid ? `${name} 광고` : name, group: paid ? 'ad' : 'etc' };
  }
  return { label: key, group: 'etc' };
}

export interface Attribution {
  /** 접속 경로의 저장 이름 */
  channel: string;
  /** 광고 이름(utm_campaign). 없으면 빈 글자 */
  campaign: string;
  /** 광고 검색어. 없으면 빈 글자 */
  keyword: string;
  /** '기타 사이트'일 때 넘어온 사이트 주소 */
  referrerHost: string;
  /** 주소에 꼬리표가 붙어 있었는지. 붙어 있으면 30분이 안 지났어도 새 방문으로 본다 */
  explicit: boolean;
}

/** 통계 이름으로 쓸 수 있게 다듬는다 (구분자로 쓰는 | 와 보이지 않는 글자를 빼고 길이를 자른다) */
export function cleanKey(value: string, max = 40): string {
  return value
    .replace(/[\u0000-\u001f\u007f|`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

function hostOf(url: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

const PAID_WORDS = new Set(['ad', 'ads', 'cpc', 'ppc', 'cpm', 'paid', 'sa', 'da', 'display', 'banner', 'paidsocial', '광고']);

function isPaidMedium(medium: string): boolean {
  if (medium.includes('paid') || medium.includes('광고')) return true;
  return medium.split(/[^a-z0-9가-힣]+/).some((word) => PAID_WORDS.has(word));
}

function fromUtm(source: string, medium: string): string {
  const paid = isPaidMedium(medium);
  if (/^(instagram|insta|ig|인스타|인스타그램)$/.test(source)) return paid ? 'instagram_ad' : 'instagram';
  if (/^(facebook|fb|페이스북)$/.test(source)) return paid ? 'facebook_ad' : 'facebook';
  if (/^(meta|메타)$/.test(source)) return paid ? 'meta_ad' : 'meta';
  if (/^(naver|네이버)$/.test(source)) {
    if (paid) return 'naver_ad';
    if (/blog|블로그/.test(medium)) return 'naver_blog';
    if (/cafe|카페/.test(medium)) return 'naver_cafe';
    if (/shop|store|쇼핑|스토어/.test(medium)) return 'naver_shop';
    if (/search|organic|검색/.test(medium)) return 'naver_search';
    return 'naver_etc';
  }
  if (/^(google|구글)$/.test(source)) return paid ? 'google_ad' : 'google_search';
  if (/^(kakao|kakaotalk|카카오|카카오톡)$/.test(source)) return paid ? 'kakao_ad' : 'kakao';
  if (/^(youtube|yt|유튜브)$/.test(source)) return paid ? 'youtube_ad' : 'youtube';
  if (/^(daum|다음)$/.test(source)) return 'daum_search';
  const name = cleanKey(source, 24);
  return name ? `${CUSTOM_PREFIX}${name}${paid ? CUSTOM_AD_SUFFIX : ''}` : 'direct';
}

function fromReferrer(host: string): string {
  const under = (domain: string) => host === domain || host.endsWith(`.${domain}`);

  if (under('naver.com') || under('naver.me')) {
    if (/(^|\.)search\.naver\.com$/.test(host)) return 'naver_search';
    if (/(^|\.)blog\.naver\.com$/.test(host)) return 'naver_blog';
    if (/(^|\.)cafe\.naver\.com$/.test(host)) return 'naver_cafe';
    if (/(smartstore|shopping|brand)\.naver\.com$/.test(host)) return 'naver_shop';
    return 'naver_etc';
  }
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return 'google_search';
  if (/(^|\.)search\.daum\.net$/.test(host)) return 'daum_search';
  if (under('bing.com') || under('yahoo.com') || under('duckduckgo.com') || under('zum.com')) return 'search_etc';
  if (under('instagram.com')) return 'instagram';
  if (under('facebook.com') || under('fb.com')) return 'facebook';
  if (under('youtube.com') || under('youtu.be')) return 'youtube';
  if (under('kakao.com')) return 'kakao';
  return 'referral';
}

// 앱 안에서 열리는 브라우저는 직전 사이트를 알려 주지 않는 일이 많아서, 어떤 앱인지로 대신 짐작한다
function fromInAppBrowser(userAgent: string): string {
  if (/Instagram/i.test(userAgent)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB/.test(userAgent)) return 'facebook';
  if (/KAKAOTALK/i.test(userAgent)) return 'kakao';
  if (/NAVER\(inapp/i.test(userAgent)) return 'naver_etc';
  return '';
}

// 네이버 검색광고가 '자동 추적'을 켰을 때 주소에 붙이는 값들
const NAVER_AD_PARAMS = ['n_media', 'n_ad', 'n_ad_group', 'n_keyword', 'n_keyword_id', 'n_query', 'n_rank', 'n_campaign_type'];
const GOOGLE_AD_PARAMS = ['gclid', 'gbraid', 'wbraid'];

export interface VisitInput {
  /** 들어온 주소의 ? 뒤 (location.search) */
  search: string;
  /** 직전 사이트 (document.referrer) */
  referrer: string;
  userAgent: string;
  /** 우리 사이트의 주소들. 여기서 넘어온 것은 밖에서 온 것으로 치지 않는다 */
  ownHosts: string[];
}

/** 이번 방문이 어디서 왔는지 판별한다. 꼬리표 → 광고 서비스가 붙인 값 → 직전 사이트 → 앱 순으로 본다 */
export function classifyVisit({ search, referrer, userAgent, ownHosts }: VisitInput): Attribution {
  const params = new URLSearchParams(search);
  const get = (name: string) => (params.get(name) ?? '').trim();
  const hasAny = (names: string[]) => names.some((name) => params.has(name));
  const campaign = cleanKey(get('utm_campaign'));
  const base = { campaign, keyword: '', referrerHost: '' };

  // 1. 광고 링크에 직접 붙인 꼬리표
  const source = get('utm_source').toLowerCase();
  if (source) {
    return {
      ...base,
      channel: fromUtm(source, get('utm_medium').toLowerCase()),
      keyword: cleanKey(get('utm_term')),
      explicit: true,
    };
  }

  // 2. 광고 서비스가 자동으로 붙이는 값
  if (hasAny(NAVER_AD_PARAMS) || /(^|\|)tr=sa(\||$)/.test(get('NaPm'))) {
    return { ...base, channel: 'naver_ad', keyword: cleanKey(get('n_keyword') || get('n_query')), explicit: true };
  }
  if (hasAny(GOOGLE_AD_PARAMS)) {
    return { ...base, channel: 'google_ad', explicit: true };
  }

  // 3. 직전 사이트
  const referrerHost = hostOf(referrer);
  const external = referrerHost && !ownHosts.includes(referrerHost) ? referrerHost : '';
  const byReferrer = external ? fromReferrer(external) : '';
  const byApp = fromInAppBrowser(userAgent);

  // 인스타 · 페이스북에서 누른 링크에 붙는 값. 광고인지는 이것만으로 알 수 없다
  if (params.has('fbclid')) {
    const known = [byReferrer, byApp].find((channel) => channel === 'instagram' || channel === 'facebook');
    return { ...base, channel: known ?? 'meta', explicit: true };
  }
  if (params.has('igshid')) {
    return { ...base, channel: 'instagram', explicit: true };
  }
  if (byReferrer) {
    return { ...base, channel: byReferrer, referrerHost: byReferrer === 'referral' ? external : '', explicit: false };
  }

  // 4. 앱 안 브라우저
  if (byApp) return { ...base, channel: byApp, explicit: false };

  return { ...base, channel: 'direct', explicit: false };
}

/** 검색 로봇 · 미리보기 수집기. 사람이 아니므로 세지 않는다 */
export const BOT_PATTERN = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|scrap|yeti|daumoa|whatsapp|pingdom|uptimerobot|prerender/i;

export type Device = 'mobile' | 'tablet' | 'desktop';

export const DEVICE_LABELS: Record<Device, string> = {
  mobile: '모바일',
  desktop: 'PC',
  tablet: '태블릿',
};

export function deviceOf(userAgent: string): Device {
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

/**
 * 통계에 쓸 페이지 주소로 정리한다. 글 번호처럼 바뀌는 부분은 [id] 로 묶는다.
 * 관리자 화면처럼 세지 않는 주소는 null.
 */
export function normalizePath(pathname: string): string | null {
  const clean = pathname.split(/[?#]/)[0].toLowerCase().replace(/\/+$/, '');
  const segments = clean.split('/').filter(Boolean);
  if (segments.length === 0) return '/';
  if (segments[0] === 'admin' || segments[0] === 'api' || segments[0].startsWith('_')) return null;

  const normalized = segments.slice(0, 4).map((segment, index) => {
    if (index === 0) return segment.replace(/[^a-z0-9\-_]/g, '_').slice(0, 24);
    // 숫자가 섞였거나 긴 조각은 글 번호 · 상품 번호로 본다
    if (/\d/.test(segment) || segment.length > 20 || /[^a-z\-_]/.test(segment)) return '[id]';
    return segment;
  });
  return `/${normalized.join('/')}`.slice(0, 60);
}

const PAGE_LABELS: Record<string, string> = {
  '/': '홈',
  '/quote': '실시간 견적',
  '/store': '스토어',
  '/store/product/[id]': '스토어 상품',
  '/contact': '고객문의',
  '/portfolio': '포트폴리오',
  '/portfolio/[id]': '포트폴리오 상세',
  '/notice': '공지사항',
  '/notice/[id]': '공지사항 글',
  '/intro': '소개',
  '/clicker': '클리커 꾸미기',
  '/shapeclicker': '쉐이프 클리커',
  // 2026-11-26 에 주소를 바꾸기 전의 이름. 그 전에 쌓인 기록은 이 이름으로 남아 있다
  '/cliker': '클리커 꾸미기 (옛 주소)',
  '/shapecliker': '쉐이프 클리커 (옛 주소)',
  '/makekeycap': '키캡 제작',
  '/freenoticeboard': '자유게시판',
  '/freenoticeboard/[id]': '자유게시판 글',
  '/freenoticeboard/write': '자유게시판 글쓰기',
  '/freenoticeboard/edit/[id]': '자유게시판 글 수정',
  '/login': '로그인',
  '/signup': '회원가입',
  '/register': '회원가입(정보 입력)',
  '/find-account': '계정 찾기',
  '/mypage': '마이페이지',
  '/mypage/orders': '주문 내역',
  '/cart': '장바구니',
  '/order': '주문',
  '/payment/success': '결제 완료',
  '/policy/privacy': '개인정보처리방침',
  '/policy/terms': '이용약관',
};

export function pageLabel(path: string): string {
  return PAGE_LABELS[path] ?? path;
}

/** 한국 시간 기준의 날짜(YYYY-MM-DD)와 시(00~23). 방문자가 어느 나라에 있든 같은 기준으로 쌓는다 */
export function kstParts(ms: number): { day: string; hour: string } {
  const shifted = new Date(ms + 9 * 60 * 60 * 1000);
  return {
    day: shifted.toISOString().slice(0, 10),
    hour: String(shifted.getUTCHours()).padStart(2, '0'),
  };
}

/** YYYY-MM-DD 에 날수를 더한다 */
export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export const QUOTE_STEPS = ['view', 'upload', 'estimate', 'save', 'inquiry'] as const;
export type QuoteStep = (typeof QUOTE_STEPS)[number];

export const QUOTE_STEP_LABELS: Record<QuoteStep, string> = {
  view: '견적 페이지 방문',
  upload: '파일 올림',
  estimate: '견적 계산',
  save: '견적 저장',
  inquiry: '견적 문의',
};

export const SITE_ORIGIN = 'https://www.maker3d.kr';

// 광고 링크 만들기에서 고르는 "어디에 쓸 링크인가"
export interface LinkPreset {
  id: string;
  label: string;
  source: string;
  medium: string;
}

export const LINK_PRESETS: LinkPreset[] = [
  { id: 'instagram_ad', label: '인스타 광고', source: 'instagram', medium: 'ad' },
  { id: 'instagram', label: '인스타 프로필 · 게시물', source: 'instagram', medium: 'profile' },
  { id: 'naver_ad', label: '네이버 광고', source: 'naver', medium: 'ad' },
  { id: 'naver_blog', label: '네이버 블로그', source: 'naver', medium: 'blog' },
  { id: 'naver_cafe', label: '네이버 카페', source: 'naver', medium: 'cafe' },
  { id: 'google_ad', label: '구글 광고', source: 'google', medium: 'ad' },
  { id: 'kakao', label: '카카오톡', source: 'kakao', medium: 'message' },
  { id: 'youtube', label: '유튜브', source: 'youtube', medium: 'video' },
];

/** 꼬리표가 붙은 주소를 만든다. path 는 '/' 로 시작하는 사이트 안 주소 */
export function buildTaggedUrl(path: string, source: string, medium: string, campaign: string): string {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, SITE_ORIGIN);
  url.searchParams.set('utm_source', source);
  if (medium) url.searchParams.set('utm_medium', medium);
  const name = cleanKey(campaign);
  if (name) url.searchParams.set('utm_campaign', name);
  return url.toString();
}
