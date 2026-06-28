import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, doc, setDoc } from "firebase/firestore";
import { ExamResult } from "../types";

// Extracted from original file
const firebaseConfig = {
  apiKey: "AIzaSyBI2vSQX7td1sfV83eBnPWfXzm-iSKvs4o",
  authDomain: "mock-up-topik.firebaseapp.com",
  projectId: "mock-up-topik",
  storageBucket: "mock-up-topik.firebasestorage.app",
  messagingSenderId: "1016359306975",
  appId: "1:1016359306975:web:d535168a553924425e4b6a"
};

export const GAS_URL = 'https://script.google.com/macros/s/AKfycbzOwJW7da8CEbdcfA1YM9bX5g-SmnEmGHBEbG9TZfhse8JCTha7saxmybmFcOMzwIWz/exec';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const appId = "topik-cbt";

export async function updateLiveSession(regNo: string, name: string, examName: string, status: 'WAITING' | 'TESTING' | 'SUBMITTED', answered: number, total: number, score?: number) {
  try {
    if (!auth.currentUser) await signInAnonymously(auth);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'active_sessions', regNo);
    await setDoc(docRef, {
      regNo, name, examName, status, answered, total, score: score ?? null, lastUpdate: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error("Live session update failed:", e);
  }
}

export async function saveResultToFirebase(resultData: ExamResult): Promise<boolean> {
  try {
    if (!auth.currentUser) await signInAnonymously(auth);
    
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'exam_results');
    await addDoc(colRef, {
      ...resultData,
      timestamp: serverTimestamp()
    });
    
    console.log("🔥 파이어베이스에 답안이 정상적으로 저장되었습니다.");
    return true;
  } catch (error: any) {
    console.error("파이어베이스 저장 에러:", error);
    alert("Firebase 통신 실패: " + error.message + "\n(데이터는 구글 시트로 우회 전송됩니다.)");
    return false; 
  }
}

export async function exportResultsToCSV() {
  try {
    if (!auth.currentUser) await signInAnonymously(auth);

    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'exam_results');
    const snapshot = await getDocs(colRef);

    if(snapshot.empty) {
      alert("저장된 응시 결과가 없습니다.");
      return;
    }

    let csvContent = "\uFEFF"; 
    csvContent += "응시일시,모의고사명,소속업체명,수험번호,이름,총점,듣기점수,읽기점수,맞은개수\n";

    snapshot.forEach(doc => {
      const d = doc.data();
      let dateStr = 'N/A';
      if (d.timestamp && d.timestamp.toDate) {
        dateStr = new Date(d.timestamp.toDate()).toLocaleString('ko-KR');
      }
      
      const examName = `"${(d.examName || '').toString().replace(/"/g, '""')}"`;
      const company = `"${(d.company || '').toString().replace(/"/g, '""')}"`;
      const regNo = `"${(d.registrationNo || '').toString().replace(/"/g, '""')}"`;
      const name = `"${(d.studentName || '').toString().replace(/"/g, '""')}"`;

      csvContent += `${dateStr},${examName},${company},${regNo},${name},${d.score},${d.lcScore},${d.rcScore},${d.correctCount}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `TOPIK_응시결과_${new Date().toISOString().slice(0,10)}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert("엑셀(CSV) 다운로드가 완료되었습니다!");
  } catch(e: any) {
    console.error("엑셀 추출 에러:", e);
    alert("데이터 다운로드 중 오류가 발생했습니다: " + e.message);
  }
}

export async function sendToGoogleSheet(data: ExamResult) {
  try {
    fetch(GAS_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) });
    console.log("구글 시트에 백업 저장되었습니다.");
  } catch(e) { 
    console.error("서버 전송 에러", e); 
  }
}
