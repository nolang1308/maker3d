import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 10000; // Render는 보통 10000 포트 사용
import bcrypt from 'bcrypt';
const clientId = process.env.NAVER_CLIENT_ID || "5msFCeD8NjQ9y68KU8whcb";
const clientSecret = process.env.NAVER_CLIENT_SECRET || "$2a$04$MXlFbXn9eAC0t3gUIj/rD.";

// 토큰 캐싱용 변수들
let cachedToken = null;
let tokenExpiry = null;

// 토큰이 유효한지 확인
function isTokenValid() {
  return cachedToken && tokenExpiry && Date.now() < tokenExpiry;
}

// 액세스 토큰 가져오기 (캐싱 적용)
async function getAccessToken() {
  if (isTokenValid()) {
    console.log('Using cached token');
    return cachedToken;
  }

  console.log('Getting new token...');
  const timestamp = Date.now();
  const password = `${clientId}_${timestamp}`;
  const hashed = bcrypt.hashSync(password, clientSecret);
  const clientSecretSign = Buffer.from(hashed, "utf-8").toString("base64");
  
  const tokenConfig = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://api.commerce.naver.com/external/v1/oauth2/token',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded', 
      'Accept': 'application/json'
    },
    data: new URLSearchParams({
      client_id: clientId,
      timestamp: timestamp.toString(),
      grant_type: 'client_credentials',
      client_secret_sign: clientSecretSign,
      type: 'SELF'
    })
  };

  try {
    const tokenResponse = await axios.request(tokenConfig);
    cachedToken = tokenResponse.data.access_token;
    // 토큰 만료 시간 설정 (현재 시간 + 55분, 5분 여유)
    tokenExpiry = Date.now() + (55 * 60 * 1000);
    
    console.log('New token obtained and cached');
    return cachedToken;
  } catch (error) {
    console.log('Token request failed:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw new Error(`토큰 발급 실패: ${error.response?.data?.message || error.message}`);
  }
}

// CORS 설정 (개발환경과 프로덕션 환경 모두 허용)
app.use(cors({
  origin: function (origin, callback) {
    // 개발환경이나 Vercel 도메인 허용
    if (!origin || 
        origin.includes('localhost') || 
        origin.includes('vercel.app') ||
        origin.includes('render.com')) {
      callback(null, true);
    } else {
      callback(null, true); // 일단 모든 origin 허용 (테스트용)
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Backend server is running!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.post('/api/naver/product/all', async (req, res) => {
  try {
    // 캐싱된 토큰 사용
    const accessToken = await getAccessToken();
    
    // 상품 목록 요청
    // const searchData = {
    //   "page": 1,
    //   "size": 50,
    //   "orderType": "NO"
    // };

    // 가장 기본적인 검색 조건만 사용
    let searchData = JSON.stringify({
      "page": 1,
      "size": 10
    });


    const productsConfig = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'https://api.commerce.naver.com/external/v1/products/search',
      headers: { 
        'Content-Type': 'application/json', 
        'Accept': 'application/json;charset=UTF-8', 
        'Authorization': `Bearer ${accessToken}`
      },
      data: searchData
    };

    const productsResponse = await axios.request(productsConfig);
    console.log('Products API response:', JSON.stringify(productsResponse.data, null, 2));
    
    res.json({
      success: true,
      data: productsResponse.data
    });
    
  } catch (error) {
    console.log('Products API error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
      details: error.response?.data || error.message
    });
  }
});
app.post('/api/naver/product/:id', async (req, res) => {
  try {
    const channelProductNo = req.params.id;
    const accessToken = await getAccessToken();
    
    // 네이버 상품 상세 정보 API
    const config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `https://api.commerce.naver.com/external/v2/products/channel-products/${channelProductNo}`,
      headers: { 
        'Accept': 'application/json;charset=UTF-8', 
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const productResponse = await axios.request(config);
    console.log('Product detail response:', JSON.stringify(productResponse.data, null, 2));
    
    res.json({
      success: true,
      data: productResponse.data
    });
    
  } catch (error) {
    console.log('Product detail API error:', error.response?.data || error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product detail',
      details: error.response?.data || error.message
    });
  }
});

app.post('/api/naver/token', async (req, res) => {
  try {
    // 캐싱된 토큰 사용
    const accessToken = await getAccessToken();
    
    res.json({
      success: true,
      data: {
        access_token: accessToken,
        token_type: 'Bearer'
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Token request failed',
      details: error.message
    });
  }
});

// 이미지 프록시 API - 네이버 이미지 403 오류 해결
app.get('/api/proxy/image', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    console.log('이미지 프록시 요청:', imageUrl);
    
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://smartstore.naver.com/'
      }
    });
    
    // 원본 이미지의 Content-Type 유지
    res.set('Content-Type', imageResponse.headers['content-type']);
    res.set('Cache-Control', 'public, max-age=86400'); // 24시간 캐시
    
    imageResponse.data.pipe(res);
    
  } catch (error) {
    console.log('이미지 프록시 오류:', error.message);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
});

