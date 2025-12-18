import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getPrintTime } from './prusaClicer.js';
import archiver from 'archiver';

// ES module에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 로컬 개발환경에서는 .env.local 파일 로드
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.local' });
}

const app = express();
const PORT = process.env.PORT || 10000; // Render는 보통 10000 포트 사용
import bcrypt from 'bcrypt';
const clientId = process.env.NAVER_CLIENT_ID;
const clientSecret = process.env.NAVER_CLIENT_SECRET;

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
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Multer 설정 (STL 파일 업로드 - 임시 저장용)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/octet-stream' || file.originalname.endsWith('.stl')) {
      cb(null, true);
    } else {
      cb(new Error('STL 파일만 업로드 가능합니다.'), false);
    }
  }
});

// Multer 설정 (주문 파일 저장용) - 동적으로 처리
const uploadOrder = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // multer는 파일을 먼저 처리하기 전에 body를 파싱하지 못할 수 있음
      // 따라서 임시로 temp 폴더에 저장 후 나중에 이동
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      cb(null, tempDir);
    },
    filename: (req, file, cb) => {
      // 고유한 임시 파일명
      const uniqueName = Date.now() + '-' + file.originalname;
      cb(null, uniqueName);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/octet-stream' || file.originalname.endsWith('.stl')) {
      cb(null, true);
    } else {
      cb(new Error('STL 파일만 업로드 가능합니다.'), false);
    }
  }
});

app.get('/', async (req, res) => {
  try {
    // 서버 IP 정보 추가
    const ipResponse = await axios.get('https://api.ipify.org?format=json');
    const serverIP = ipResponse.data.ip;
    
    console.log('서버 IP:', serverIP); // 로그에 출력
    
    res.json({ 
      message: 'Backend server is running!',
      serverIP: serverIP,
      note: '이 IP를 네이버 커머스 API에 등록하세요'
    });
  } catch (error) {
    res.json({ message: 'Backend server is running!' });
  }
});

// 서버 IP 확인 API
app.get('/api/server-info', async (req, res) => {
  try {
    // 외부 서비스를 통해 서버의 공인 IP 확인
    const ipResponse = await axios.get('https://api.ipify.org?format=json');
    const serverIP = ipResponse.data.ip;
    
    res.json({
      success: true,
      serverIP: serverIP,
      timestamp: new Date().toISOString(),
      message: '이 IP를 네이버 커머스 API 허용 목록에 추가해주세요',
      // GCS 환경변수 상태 체크 (보안상 실제 값은 숨김)
      gcsConfig: {
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID ? '설정됨' : '설정안됨',
        bucketName: process.env.GOOGLE_CLOUD_BUCKET_NAME ? '설정됨' : '설정안됨',
        credentialsJson: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? '설정됨' : '설정안됨',
        credentialsFile: process.env.GOOGLE_APPLICATION_CREDENTIALS ? '설정됨' : '설정안됨'
      }
    });
  } catch (error) {
    res.json({
      success: false,
      error: 'IP 확인 실패',
      timestamp: new Date().toISOString()
    });
  }
});

// GCS 연결 테스트 API
app.get('/api/test-gcs', async (req, res) => {
  try {
    // 간단한 GCS 연결 테스트
    const response = await axios.get('https://www.googleapis.com/storage/v1/b', {
      params: {
        project: process.env.GOOGLE_CLOUD_PROJECT_ID
      },
      headers: {
        'Authorization': `Bearer ${process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? 'test' : 'missing'}`
      }
    });
    
    res.json({
      success: true,
      message: 'GCS 기본 연결 테스트 완료',
      buckets: response.data
    });
  } catch (error) {
    res.json({
      success: false,
      error: 'GCS 연결 실패',
      details: error.message,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      hasCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    });
  }
});

// 파일 업로드 API (GCS)
app.post('/api/upload', async (req, res) => {
  res.json({
    success: false,
    message: 'GCS 파일 업로드는 프론트엔드에서 처리됩니다. Vercel 환경변수를 확인하세요.',
    note: 'GOOGLE_APPLICATION_CREDENTIALS_JSON을 Vercel에 설정해주세요.'
  });
});

// STL 파일 업로드 및 프린팅 시간 계산 API
// 소재별 기본 가격 (원/시간)
const MATERIAL_PRICES = {
  '광경화성 레진': 15000,
  'PLA': 8000,
  'ABS': 10000,
  'PETG': 12000,
  'TPU': 18000
};

// 색상별 추가 비용 (원)
const COLOR_PRICES = {
  'G40-JG': 5000,
  '화이트': 0,
  '블랙': 2000,
  '그레이': 1000,
  '투명': 3000
};

// 시간 문자열을 시간(숫자)로 변환하는 함수
function parseTimeToHours(timeString) {
  const hours = timeString.match(/(\d+)h/)?.[1] || '0';
  const minutes = timeString.match(/(\d+)m/)?.[1] || '0';
  const seconds = timeString.match(/(\d+)s/)?.[1] || '0';

  return parseInt(hours) + parseInt(minutes) / 60 + parseInt(seconds) / 3600;
}

app.post('/api/upload-stl', upload.single('stlFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'STL 파일이 업로드되지 않았습니다.' });
    }

    const filePath = req.file.path;
    const { material, color } = req.body;

    console.log('STL 파일 업로드됨:', filePath);
    console.log('견적 정보:', { material, color });

    // PrusaSlicer로 프린팅 시간 계산
    const printTime = await getPrintTime(filePath);
    console.log('프린팅 시간:', printTime);

    // 가격 계산 (개당 가격)
    const printHours = parseTimeToHours(printTime);
    const materialPrice = MATERIAL_PRICES[material] || 10000;
    const colorPrice = COLOR_PRICES[color] || 0;

    // 개당 가격 = (프린팅 시간 * 소재 시간당 가격) + 색상 추가 비용 + 기본 재료비
    const baseMaterialCost = 20000; // 기본 재료비
    const estimatedPrice = Math.round((printHours * materialPrice) + colorPrice + baseMaterialCost);

    console.log('가격 계산:', {
      printHours: printHours.toFixed(2),
      materialPrice,
      colorPrice,
      baseMaterialCost,
      estimatedPrice
    });

    // 업로드된 STL 파일 삭제 (처리 완료 후)
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      printTime: printTime,
      estimatedPrice: estimatedPrice,
      originalName: req.file.originalname,
      calculation: {
        printHours: printHours.toFixed(2),
        material: material,
        color: color
      }
    });

  } catch (error) {
    console.error('Error processing STL file:', error);

    // 오류 발생 시 업로드된 파일 삭제
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: 'STL 파일 처리 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 주문 파일 저장 API
app.post('/api/upload-order-files', uploadOrder.array('files', 10), async (req, res) => {
  try {
    const { orderNumber } = req.body;

    console.log('주문 파일 업로드 요청 받음:', {
      orderNumber,
      filesCount: req.files?.length,
      body: req.body
    });

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        error: '주문번호가 필요합니다.'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: '파일이 업로드되지 않았습니다.'
      });
    }

    // 주문 폴더 생성
    const orderDir = path.join(__dirname, 'orders', orderNumber);
    if (!fs.existsSync(orderDir)) {
      fs.mkdirSync(orderDir, { recursive: true });
    }

    // 임시 폴더에서 주문 폴더로 파일 이동
    const filePaths = [];
    for (const file of req.files) {
      const tempPath = file.path;
      const originalName = file.originalname;
      const newPath = path.join(orderDir, originalName);

      // 파일 이동
      fs.renameSync(tempPath, newPath);

      // 상대 경로 저장
      filePaths.push(`/orders/${orderNumber}/${originalName}`);
    }

    console.log(`주문 ${orderNumber} 파일 저장 완료:`, filePaths);

    res.json({
      success: true,
      orderNumber: orderNumber,
      filePaths: filePaths,
      fileCount: req.files.length
    });

  } catch (error) {
    console.error('주문 파일 저장 오류:', error);

    // 오류 발생 시 임시 파일 삭제
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      success: false,
      error: '파일 저장 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// ============================================
// 자유게시판 파일 업로드/다운로드/삭제 API
// ============================================

// Multer 설정 (자유게시판 파일 업로드용)
const uploadFreeNotice = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      cb(null, tempDir);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const fileExtension = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, fileExtension);
      const fileName = `${timestamp}_${randomId}_${baseName}${fileExtension}`;
      cb(null, fileName);
    }
  }),
  limits: {
    fileSize: Infinity // 파일 크기 제한 없음
  }
});

// 자유게시판 파일 업로드 API
app.post('/api/upload-freenotice-files', uploadFreeNotice.array('files', 10), async (req, res) => {
  try {
    const { postId } = req.body;

    console.log('자유게시판 파일 업로드 요청:', {
      postId,
      filesCount: req.files?.length
    });

    if (!postId) {
      // postId 없으면 업로드된 파일 삭제
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      return res.status(400).json({
        success: false,
        error: '게시글 ID가 필요합니다.'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.json({
        success: true,
        files: [],
        message: '업로드할 파일이 없습니다.'
      });
    }

    // freenoticeboard 폴더 생성
    const postDir = path.join(__dirname, 'freenoticeboard', postId);
    if (!fs.existsSync(postDir)) {
      fs.mkdirSync(postDir, { recursive: true });
    }

    // 임시 폴더에서 freenoticeboard 폴더로 파일 이동
    const uploadedFiles = [];
    for (const file of req.files) {
      const tempPath = file.path;
      const newPath = path.join(postDir, file.filename);

      // 파일 이동
      fs.renameSync(tempPath, newPath);

      uploadedFiles.push({
        name: file.originalname,
        url: `/api/download-freenotice-file/${postId}/${file.filename}`,
        size: file.size
      });
    }

    console.log(`게시글 ${postId} 파일 업로드 완료:`, uploadedFiles);

    res.json({
      success: true,
      files: uploadedFiles
    });

  } catch (error) {
    console.error('자유게시판 파일 업로드 오류:', error);

    // 오류 발생 시 임시 파일 삭제
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      success: false,
      error: '파일 업로드 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 자유게시판 파일 다운로드 API
app.get('/api/download-freenotice-file/:postId/:filename', (req, res) => {
  try {
    const { postId, filename } = req.params;
    const filePath = path.join(__dirname, 'freenoticeboard', postId, filename);

    console.log('자유게시판 파일 다운로드 요청:', filePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: '파일을 찾을 수 없습니다.'
      });
    }

    // 파일명에서 타임스탬프와 랜덤ID 제거하여 원본 파일명 복원
    const parts = filename.split('_');
    let originalName = filename;
    if (parts.length >= 3) {
      originalName = parts.slice(2).join('_');
    }

    res.download(filePath, originalName, (err) => {
      if (err) {
        console.error('파일 다운로드 오류:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: '파일 다운로드 중 오류가 발생했습니다.'
          });
        }
      }
    });

  } catch (error) {
    console.error('파일 다운로드 오류:', error);
    res.status(500).json({
      success: false,
      error: '파일 다운로드 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 자유게시판 파일 삭제 API
app.delete('/api/delete-freenotice-file', async (req, res) => {
  try {
    const { fileUrl } = req.query;

    if (!fileUrl) {
      return res.status(400).json({
        success: false,
        error: '파일 URL이 필요합니다.'
      });
    }

    // URL에서 postId와 filename 추출
    const urlParts = fileUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    const postId = urlParts[urlParts.length - 2];

    const filePath = path.join(__dirname, 'freenoticeboard', postId, filename);

    console.log('자유게시판 파일 삭제 요청:', filePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: '파일을 찾을 수 없습니다.'
      });
    }

    fs.unlinkSync(filePath);
    console.log('파일 삭제 완료:', filePath);

    res.json({
      success: true,
      message: '파일이 삭제되었습니다.'
    });

  } catch (error) {
    console.error('파일 삭제 오류:', error);
    res.status(500).json({
      success: false,
      error: '파일 삭제 중 오류가 발생했습니다.',
      details: error.message
    });
  }
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

// 주문 파일 다운로드 API (ZIP 압축)
app.get('/api/download-order-files/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const orderDir = path.join(__dirname, 'orders', orderNumber);

    console.log('파일 다운로드 요청:', orderNumber);

    // 주문 폴더 존재 여부 확인
    if (!fs.existsSync(orderDir)) {
      return res.status(404).json({
        success: false,
        error: '주문 파일을 찾을 수 없습니다.'
      });
    }

    // 폴더 내 파일 목록 조회
    const files = fs.readdirSync(orderDir);

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        error: '다운로드할 파일이 없습니다.'
      });
    }

    // ZIP 파일명 설정
    const zipFileName = `${orderNumber}.zip`;

    // 응답 헤더 설정
    res.attachment(zipFileName);
    res.set('Content-Type', 'application/zip');

    // archiver를 사용하여 ZIP 생성
    const archive = archiver('zip', {
      zlib: { level: 9 } // 최대 압축
    });

    // 에러 처리
    archive.on('error', (err) => {
      console.error('ZIP 생성 오류:', err);
      res.status(500).json({
        success: false,
        error: 'ZIP 파일 생성 중 오류가 발생했습니다.'
      });
    });

    // 스트림 연결
    archive.pipe(res);

    // 폴더의 모든 파일을 ZIP에 추가
    files.forEach(file => {
      const filePath = path.join(orderDir, file);
      archive.file(filePath, { name: file });
    });

    // ZIP 생성 완료
    await archive.finalize();

    console.log(`주문 ${orderNumber} 파일 다운로드 완료 (${files.length}개 파일)`);

  } catch (error) {
    console.error('파일 다운로드 오류:', error);
    res.status(500).json({
      success: false,
      error: '파일 다운로드 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// ============================================
// 포트폴리오 이미지 업로드 API
// ============================================

// Multer 설정 (포트폴리오 이미지 업로드용)
const uploadPortfolio = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const portfolioDir = path.join(__dirname, 'portfolio');
      if (!fs.existsSync(portfolioDir)) {
        fs.mkdirSync(portfolioDir, { recursive: true });
      }
      cb(null, portfolioDir);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const fileExtension = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, fileExtension);
      const fileName = `${timestamp}_${randomId}_${baseName}${fileExtension}`;
      cb(null, fileName);
    }
  }),
  limits: {
    fileSize: Infinity // 파일 크기 제한 없음
  },
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
    }
  }
});

// 포트폴리오 이미지 업로드 API
app.post('/api/upload-portfolio-image', uploadPortfolio.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '이미지 파일이 업로드되지 않았습니다.'
      });
    }

    const imageUrl = `/api/portfolio-image/${req.file.filename}`;

    console.log('포트폴리오 이미지 업로드 완료:', imageUrl);

    res.json({
      success: true,
      imageUrl: imageUrl,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });

  } catch (error) {
    console.error('포트폴리오 이미지 업로드 오류:', error);

    // 오류 발생 시 업로드된 파일 삭제
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: '이미지 업로드 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 포트폴리오 이미지 다운로드/조회 API
app.get('/api/portfolio-image/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'portfolio', filename);

    console.log('포트폴리오 이미지 요청:', filePath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: '이미지를 찾을 수 없습니다.'
      });
    }

    // 이미지 전송
    res.sendFile(filePath);

  } catch (error) {
    console.error('이미지 전송 오류:', error);
    res.status(500).json({
      success: false,
      error: '이미지 전송 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 포트폴리오 이미지 삭제 API
app.delete('/api/delete-portfolio-image', async (req, res) => {
  try {
    const { imageUrl } = req.query;

    console.log('포트폴리오 이미지 삭제 요청:', imageUrl);

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: '이미지 경로가 필요합니다.'
      });
    }

    // imageUrl 형식: /api/portfolio-image/filename
    const filename = imageUrl.split('/').pop();
    const filePath = path.join(__dirname, 'portfolio', filename);

    console.log('실제 파일 경로:', filePath);

    if (!fs.existsSync(filePath)) {
      console.log('파일이 존재하지 않음:', filePath);
      return res.json({
        success: true,
        message: '파일이 이미 존재하지 않습니다.'
      });
    }

    // 파일 삭제
    fs.unlinkSync(filePath);
    console.log('파일 삭제 완료:', filename);

    res.json({
      success: true,
      message: '이미지가 삭제되었습니다.'
    });

  } catch (error) {
    console.error('이미지 삭제 오류:', error);
    res.status(500).json({
      success: false,
      error: '이미지 삭제 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// ============================================
// 공지사항 파일 업로드/다운로드/삭제 API
// ============================================

// Multer 설정 (공지사항 파일 업로드용) - 임시 폴더 사용
const uploadNotice = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // 먼저 temp 폴더에 저장
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      cb(null, tempDir);
    },
    filename: (req, file, cb) => {
      // 타임스탬프와 랜덤값을 추가하여 중복 방지
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const fileExtension = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, fileExtension);
      const fileName = `${timestamp}_${randomId}_${baseName}${fileExtension}`;
      cb(null, fileName);
    }
  }),
  limits: {
    fileSize: Infinity // 파일 크기 제한 없음
  }
});

// 공지사항 파일 업로드 API
app.post('/api/upload-notice-files', uploadNotice.array('files', 10), async (req, res) => {
  try {
    const { noticeId } = req.body;

    console.log('공지사항 파일 업로드 요청:', {
      noticeId,
      filesCount: req.files?.length,
      body: req.body
    });

    if (!noticeId) {
      // noticeId 없으면 업로드된 파일 삭제
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      return res.status(400).json({
        success: false,
        error: '공지사항 ID가 필요합니다.'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.json({
        success: true,
        files: [],
        message: '업로드할 파일이 없습니다.'
      });
    }

    // notices 폴더 생성
    const noticeDir = path.join(__dirname, 'notices', noticeId);
    if (!fs.existsSync(noticeDir)) {
      fs.mkdirSync(noticeDir, { recursive: true });
    }

    // 임시 폴더에서 notices 폴더로 파일 이동
    const uploadedFiles = [];
    for (const file of req.files) {
      const tempPath = file.path;
      const newPath = path.join(noticeDir, file.filename);

      // 파일 이동
      fs.renameSync(tempPath, newPath);

      uploadedFiles.push({
        name: file.originalname,
        url: `/api/download-notice-file/${noticeId}/${file.filename}`,
        size: file.size,
        type: file.mimetype
      });
    }

    console.log(`공지사항 ${noticeId} 파일 업로드 완료:`, uploadedFiles.length, '개');

    res.json({
      success: true,
      files: uploadedFiles,
      message: `${uploadedFiles.length}개 파일이 성공적으로 업로드되었습니다.`
    });

  } catch (error) {
    console.error('공지사항 파일 업로드 오류:', error);

    // 오류 발생 시 업로드된 파일 삭제
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      success: false,
      error: '파일 업로드 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 공지사항 파일 다운로드 API
app.get('/api/download-notice-file/:noticeId/:filename', async (req, res) => {
  try {
    const { noticeId, filename } = req.params;
    const filePath = path.join(__dirname, 'notices', noticeId, filename);

    console.log('공지사항 파일 다운로드 요청:', filePath);

    // 파일 존재 여부 확인
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: '파일을 찾을 수 없습니다.'
      });
    }

    // 파일 다운로드
    res.download(filePath, (err) => {
      if (err) {
        console.error('파일 다운로드 오류:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: '파일 다운로드 중 오류가 발생했습니다.'
          });
        }
      } else {
        console.log(`파일 다운로드 완료: ${filename}`);
      }
    });

  } catch (error) {
    console.error('파일 다운로드 오류:', error);
    res.status(500).json({
      success: false,
      error: '파일 다운로드 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

// 공지사항 파일 삭제 API
app.delete('/api/delete-notice-file', async (req, res) => {
  try {
    const { filePath } = req.query;

    console.log('공지사항 파일 삭제 요청:', filePath);

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: '파일 경로가 필요합니다.'
      });
    }

    // filePath 형식: /api/download-notice-file/noticeId/filename
    // 실제 경로로 변환: backend/notices/noticeId/filename
    const pathParts = filePath.split('/');
    const noticeId = pathParts[pathParts.length - 2];
    const filename = pathParts[pathParts.length - 1];
    const actualPath = path.join(__dirname, 'notices', noticeId, filename);

    console.log('실제 파일 경로:', actualPath);

    // 파일 존재 여부 확인
    if (!fs.existsSync(actualPath)) {
      console.log('파일이 존재하지 않음:', actualPath);
      return res.json({
        success: true,
        message: '파일이 이미 존재하지 않습니다.'
      });
    }

    // 파일 삭제
    fs.unlinkSync(actualPath);
    console.log('파일 삭제 완료:', filename);

    // 폴더가 비어있으면 폴더도 삭제
    const noticeDir = path.join(__dirname, 'notices', noticeId);
    const remainingFiles = fs.readdirSync(noticeDir);
    if (remainingFiles.length === 0) {
      fs.rmdirSync(noticeDir);
      console.log('빈 폴더 삭제:', noticeId);
    }

    res.json({
      success: true,
      message: '파일이 삭제되었습니다.'
    });

  } catch (error) {
    console.error('파일 삭제 오류:', error);
    res.status(500).json({
      success: false,
      error: '파일 삭제 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

