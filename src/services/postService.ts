import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  startAfter, 
  where,
  DocumentSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/config/firebase';

// 게시글 타입 정의
export interface Post {
  id: string;
  title: string;
  content: string;
  author: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  views: number;
  likes: number;
  password?: string;
  category?: string;
  tags?: string[];
  attachments?: {
    name: string;
    url: string;
    size: number;
  }[];
}

// Firestore 문서를 Post 타입으로 변환
function documentToPost(doc: DocumentSnapshot): Post | null {
  if (!doc.exists()) return null;
  
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title || '',
    content: data.content || '',
    author: data.author || '',
    authorId: data.authorId || '',
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    views: data.views || 0,
    likes: data.likes || 0,
    password: data.password,
    category: data.category,
    tags: data.tags || [],
    attachments: data.attachments || []
  };
}

// 게시글 목록 조회
export async function getPosts(
  page: number = 1,
  limitCount: number = 20,
  category?: string
): Promise<{
  posts: Post[];
  totalCount: number;
  hasMore: boolean;
  lastDoc?: any;
}> {
  try {
    // limitCount가 유효한 숫자인지 확인
    const validLimit = limitCount && limitCount > 0 ? limitCount : 20;
    
    const postsRef = collection(db, 'posts');
    let postsQuery = query(
      postsRef,
      orderBy('createdAt', 'desc'),
      limit(validLimit)
    );

    if (category) {
      postsQuery = query(
        postsRef,
        where('category', '==', category),
        orderBy('createdAt', 'desc'),
        limit(validLimit)
      );
    }

    const snapshot = await getDocs(postsQuery);
    const posts: Post[] = [];
    
    snapshot.forEach((doc) => {
      const post = documentToPost(doc);
      if (post) {
        posts.push(post);
      }
    });

    return {
      posts,
      totalCount: posts.length, // 실제로는 별도 쿼리로 전체 개수 조회 필요
      hasMore: snapshot.docs.length === validLimit,
      lastDoc: snapshot.docs[snapshot.docs.length - 1]
    };
  } catch (error) {
    console.error('Error fetching posts:', error);
    return {
      posts: [],
      totalCount: 0,
      hasMore: false
    };
  }
}

// 게시글 검색
export async function searchPosts(
  searchTerm: string,
  page: number = 1,
  limitCount: number = 20
): Promise<{
  posts: Post[];
  totalCount: number;
  hasMore: boolean;
}> {
  try {
    // Firestore에서는 텍스트 검색이 제한적이므로 전체 데이터를 가져와서 클라이언트에서 필터링
    const postsRef = collection(db, 'posts');
    const postsQuery = query(postsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(postsQuery);
    
    const allPosts: Post[] = [];
    snapshot.forEach((doc) => {
      const post = documentToPost(doc);
      if (post) {
        allPosts.push(post);
      }
    });

    // 클라이언트에서 검색 필터링
    const filteredPosts = allPosts.filter(post => 
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.author.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // limitCount가 유효한 숫자인지 확인
    const validLimit = limitCount && limitCount > 0 ? limitCount : 20;
    const validPage = page && page > 0 ? page : 1;
    
    const startIndex = (validPage - 1) * validLimit;
    const endIndex = startIndex + validLimit;
    const paginatedPosts = filteredPosts.slice(startIndex, endIndex);

    return {
      posts: paginatedPosts,
      totalCount: filteredPosts.length,
      hasMore: endIndex < filteredPosts.length
    };
  } catch (error) {
    console.error('Error searching posts:', error);
    return {
      posts: [],
      totalCount: 0,
      hasMore: false
    };
  }
}

// 개별 게시글 조회
export async function getPost(id: string): Promise<Post | null> {
  try {
    const postDoc = await getDoc(doc(db, 'posts', id));
    return documentToPost(postDoc);
  } catch (error) {
    console.error('Error fetching post:', error);
    return null;
  }
}

// 게시글 폼 데이터 타입
export interface PostFormData {
  title: string;
  content: string;
  category?: string;
  password?: string;
  tags?: string[];
  files?: File[];
}

// 게시글 생성
export async function createPost(
  formData: PostFormData,
  authorId: string,
  authorName: string
): Promise<Post> {
  try {
    // 먼저 게시글 문서를 생성
    const newPostData = {
      title: formData.title,
      content: formData.content,
      author: authorName,
      authorId: authorId,
      category: formData.category || 'write',
      password: formData.password,
      tags: formData.tags || [],
      attachments: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      views: 0,
      likes: 0
    };

    const docRef = await addDoc(collection(db, 'posts'), newPostData);
    const postId = docRef.id;

    console.log('게시글 생성 완료, ID:', postId);

    // 파일이 있으면 업로드
    let attachments: { name: string; url: string; size: number }[] = [];
    if (formData.files && formData.files.length > 0) {
      try {
        console.log('파일 업로드 시작:', formData.files.length, '개');

        const uploadFormData = new FormData();
        uploadFormData.append('postId', postId);

        formData.files.forEach(file => {
          uploadFormData.append('files', file);
        });

        // 직접 백엔드로 호출 (Vercel 제한 우회)
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
        const uploadResponse = await fetch(`${backendUrl}/api/upload-freenotice-files`, {
          method: 'POST',
          body: uploadFormData
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          attachments = uploadResult.files || [];
          console.log('파일 업로드 성공:', attachments);

          // Firestore에 첨부파일 정보 업데이트
          await updateDoc(doc(db, 'posts', postId), {
            attachments: attachments
          });
        } else {
          const errorData = await uploadResponse.json();
          console.error('파일 업로드 실패:', errorData);
        }
      } catch (uploadError) {
        console.error('파일 업로드 에러:', uploadError);
        // 파일 업로드 실패해도 게시글은 생성되도록 함
      }
    }

    return {
      id: postId,
      title: formData.title,
      content: formData.content,
      author: authorName,
      authorId: authorId,
      category: formData.category || 'write',
      password: formData.password,
      tags: formData.tags || [],
      attachments: attachments,
      createdAt: new Date(),
      updatedAt: new Date(),
      views: 0,
      likes: 0
    };
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
}

// 게시글 수정
export async function updatePost(id: string, updates: Partial<Post>): Promise<Post | null> {
  try {
    const updateData = {
      ...updates,
      updatedAt: Timestamp.now()
    };

    await updateDoc(doc(db, 'posts', id), updateData);
    
    // 수정된 게시글 반환
    return await getPost(id);
  } catch (error) {
    console.error('Error updating post:', error);
    return null;
  }
}

// 게시글 삭제
export async function deletePost(id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'posts', id));
    return true;
  } catch (error) {
    console.error('Error deleting post:', error);
    return false;
  }
}

// 조회수 증가
export async function incrementViews(id: string): Promise<boolean> {
  try {
    const postRef = doc(db, 'posts', id);
    const postDoc = await getDoc(postRef);
    
    if (postDoc.exists()) {
      const currentViews = postDoc.data().views || 0;
      await updateDoc(postRef, {
        views: currentViews + 1
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error incrementing views:', error);
    return false;
  }
}