import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { 
  getFirestore, collection, addDoc, serverTimestamp, getDocs, 
  doc, setDoc, getDoc, onSnapshot, deleteDoc, updateDoc 
} from "firebase/firestore";
import { ExamResult, Question } from "../types";

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

export async function ensureAuth() {
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  } catch (e) {
    console.warn("Firebase anonymous auth fallback:", e);
  }
}

// ----------------- Real-time Exam Config (Active Slot & Available Slots) -----------------

export interface ExamConfig {
  activeExamName: string;
  availableExams: string[];
}

const DEFAULT_EXAMS = [
  '모의고사1회', '모의고사2회', '모의고사3회',
  '모의고사4회', '모의고사5회', '모의고사6회'
];

export async function getExamConfig(): Promise<ExamConfig> {
  try {
    await ensureAuth();
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'exam_config');
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        activeExamName: data.activeExamName || '모의고사1회',
        availableExams: Array.isArray(data.availableExams) && data.availableExams.length > 0 
          ? data.availableExams 
          : DEFAULT_EXAMS
      };
    }
  } catch (e) {
    console.warn("Failed to get exam config from Firestore:", e);
  }

  return {
    activeExamName: '모의고사1회',
    availableExams: DEFAULT_EXAMS
  };
}

export function subscribeExamConfig(callback: (config: ExamConfig) => void): () => void {
  const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'exam_config');
  return onSnapshot(configRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      callback({
        activeExamName: data.activeExamName || '모의고사1회',
        availableExams: Array.isArray(data.availableExams) && data.availableExams.length > 0
          ? data.availableExams
          : DEFAULT_EXAMS
      });
    }
  }, (err) => {
    console.warn("Exam config onSnapshot error:", err);
  });
}

export async function updateActiveExam(examName: string, currentAvailable?: string[]): Promise<boolean> {
  try {
    await ensureAuth();
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'exam_config');
    const existing = await getDoc(configRef);
    let available = currentAvailable || DEFAULT_EXAMS;
    if (existing.exists()) {
      const d = existing.data();
      if (Array.isArray(d.availableExams) && d.availableExams.length > 0) {
        available = d.availableExams;
      }
    }
    if (!available.includes(examName)) {
      available = [...available, examName];
    }

    await setDoc(configRef, {
      activeExamName: examName,
      availableExams: available,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Background sync to GAS
    fetch(GAS_URL, { 
      method: 'POST', 
      mode: 'no-cors', 
      body: JSON.stringify({ action: 'setActiveExam', examName }) 
    }).catch(err => console.warn("GAS background sync error:", err));

    return true;
  } catch (e) {
    console.error("updateActiveExam error:", e);
    return false;
  }
}

export async function addAvailableExamSlot(examName: string): Promise<boolean> {
  try {
    await ensureAuth();
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'exam_config');
    const existing = await getDoc(configRef);
    let available = DEFAULT_EXAMS;
    let active = examName;
    if (existing.exists()) {
      const d = existing.data();
      available = Array.isArray(d.availableExams) ? d.availableExams : DEFAULT_EXAMS;
      active = d.activeExamName || examName;
    }
    if (!available.includes(examName)) {
      available = [...available, examName];
    }

    await setDoc(configRef, {
      activeExamName: active,
      availableExams: available,
      updatedAt: serverTimestamp()
    }, { merge: true });

    fetch(GAS_URL, { 
      method: 'POST', 
      mode: 'no-cors', 
      body: JSON.stringify({ action: 'setActiveExam', examName }) 
    }).catch(err => console.warn("GAS background sync error:", err));

    return true;
  } catch (e) {
    console.error("addAvailableExamSlot error:", e);
    return false;
  }
}

// ----------------- Fast Slot Questions Persistence -----------------

export async function saveExamQuestionsToFirestore(examName: string, questions: Question[]): Promise<boolean> {
  try {
    await ensureAuth();
    const slotDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'exam_slots', examName);
    const realCount = questions.filter(x => x.num !== '예시' && x.num !== '보기').length;
    await setDoc(slotDocRef, {
      examName,
      questions,
      questionCount: realCount || questions.length,
      totalItemsCount: questions.length,
      updatedAt: serverTimestamp()
    });

    // Also background sync to GAS
    const dataForGas = questions.map((o: any) => [
      o.num ?? "", o.type ?? "", o.passage ?? "", o.question ?? "",
      o.image ?? "", o.options?.[0] ?? o.opt1 ?? "", o.options?.[1] ?? o.opt2 ?? "",
      o.options?.[2] ?? o.opt3 ?? "", o.options?.[3] ?? o.opt4 ?? "",
      o.answer !== undefined && o.answer !== "" ? (typeof o.answer === 'number' ? o.answer + 1 : o.answer) : "",
      o.score ?? ""
    ]);

    fetch(GAS_URL, { 
      method: 'POST', 
      mode: 'no-cors', 
      body: JSON.stringify({ action: 'saveQuestions', examName, questionsData: dataForGas }) 
    }).catch(err => console.warn("GAS save questions sync warning:", err));

    return true;
  } catch (e) {
    console.error("Failed to save questions to Firestore:", e);
    return false;
  }
}

export async function getExamQuestionsFromFirestore(examName: string): Promise<Question[] | null> {
  try {
    await ensureAuth();
    const slotDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'exam_slots', examName);
    const snap = await getDoc(slotDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        return data.questions;
      }
    }
  } catch (e) {
    console.warn(`Firestore getQuestions for ${examName} error:`, e);
  }
  return null;
}

// ----------------- Live Session & Results -----------------

export async function updateLiveSession(regNo: string, name: string, examName: string, status: 'WAITING' | 'TESTING' | 'SUBMITTED', answered: number, total: number, score?: number) {
  try {
    await ensureAuth();
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'active_sessions', regNo);
    await setDoc(docRef, {
      regNo, name, examName, status, answered, total, score: score ?? null, lastUpdate: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error("Live session update failed:", e);
  }
}

export async function deleteLiveSession(regNo: string): Promise<boolean> {
  try {
    await ensureAuth();
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'active_sessions', regNo));
    return true;
  } catch (e) {
    console.error("Failed to delete live session:", e);
    return false;
  }
}

export async function updateLiveSessionCandidate(
  oldRegNo: string,
  data: { regNo: string; name: string; examName?: string }
): Promise<boolean> {
  try {
    await ensureAuth();
    const cleanOld = (oldRegNo || '').trim();
    const cleanNew = (data.regNo || '').trim();
    const cleanName = (data.name || '').trim();
    const cleanExam = data.examName ? data.examName.trim() : undefined;

    if (!cleanNew || !cleanName) {
      throw new Error("수험번호와 이름은 필수 항목입니다.");
    }

    const oldDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'active_sessions', cleanOld);
    const snap = await getDoc(oldDocRef);
    const existing = snap.exists() ? snap.data() : {};

    const updatedData = {
      ...existing,
      regNo: cleanNew,
      name: cleanName,
      ...(cleanExam ? { examName: cleanExam } : {}),
      lastUpdate: serverTimestamp()
    };

    if (cleanNew !== cleanOld) {
      // Re-key document with new registration number
      const newDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'active_sessions', cleanNew);
      await setDoc(newDocRef, updatedData);
      await deleteDoc(oldDocRef);
    } else {
      await updateDoc(oldDocRef, {
        name: cleanName,
        ...(cleanExam ? { examName: cleanExam } : {}),
        lastUpdate: serverTimestamp()
      });
    }
    return true;
  } catch (e) {
    console.error("Failed to update live session candidate info:", e);
    return false;
  }
}

export async function saveResultToFirebase(resultData: ExamResult): Promise<boolean> {
  try {
    await ensureAuth();
    
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'exam_results');
    await addDoc(colRef, {
      ...resultData,
      timestamp: serverTimestamp()
    });
    
    console.log("🔥 파이어베이스에 답안이 정상적으로 저장되었습니다.");
    return true;
  } catch (error: any) {
    console.error("파이어베이스 저장 에러:", error);
    return false; 
  }
}

export async function updateExamResultCandidate(
  id: string,
  data: { studentName: string; registrationNo: string; company: string; examName?: string }
): Promise<boolean> {
  try {
    await ensureAuth();
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'exam_results', id);
    const cleanName = (data.studentName || '').trim();
    const cleanReg = (data.registrationNo || '').trim();
    const cleanComp = (data.company || '').trim();
    const cleanExam = data.examName ? data.examName.trim() : undefined;

    if (!cleanName || !cleanReg) {
      throw new Error("수험번호와 이름은 필수 항목입니다.");
    }

    await updateDoc(docRef, {
      studentName: cleanName,
      registrationNo: cleanReg,
      company: cleanComp,
      ...(cleanExam ? { examName: cleanExam } : {}),
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (e) {
    console.error("Failed to update exam result candidate info:", e);
    return false;
  }
}

export async function deleteExamResult(id: string): Promise<boolean> {
  try {
    await ensureAuth();
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'exam_results', id));
    return true;
  } catch (e) {
    console.error("Failed to delete exam result:", e);
    return false;
  }
}

export async function exportResultsToCSV() {
  try {
    await ensureAuth();

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

