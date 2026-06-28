import React from 'react';

export const i18n = {
    ko: {
        standby: "SYSTEM STANDBY",
        timeLimit: "TIME_LIMIT",
        min: "MIN",
        totalQs: "TOTAL_QUESTIONS",
        qs: "Qs",
        instruction: "INSTRUCTION",
        instText: "시험 감독관의 시작 지시가 있을 때까지 대기해 주십시오.<br>듣기 평가는 중앙 방송에 맞춰 모든 응시자가 동시에 시작합니다.",
        beginBtn: "BEGIN EXAM",
        backBtn: "◀ GO BACK",
        subtitle: "응시자 정보 입력",
        regNoLabel: "REGISTRATION NO.",
        nameLabel: "CANDIDATE NAME"
    },
    en: {
        standby: "SYSTEM STANDBY",
        timeLimit: "TIME LIMIT",
        min: "MIN",
        totalQs: "TOTAL QUESTIONS",
        qs: "Qs",
        instruction: "INSTRUCTION",
        instText: "Please wait until the proctor instructs you to begin.<br>The listening test will start simultaneously for all candidates via central broadcast.",
        beginBtn: "BEGIN EXAM",
        backBtn: "◀ GO BACK",
        subtitle: "ENTER CANDIDATE INFORMATION",
        regNoLabel: "REGISTRATION NO.",
        nameLabel: "CANDIDATE NAME"
    },
    id: {
        standby: "SISTEM BERSIAP",
        timeLimit: "BATAS WAKTU",
        min: "MENIT",
        totalQs: "TOTAL PERTANYAAN",
        qs: "Soal",
        instruction: "PETUNJUK",
        instText: "Harap tunggu sampai pengawas menginstruksikan Anda untuk mulai.<br>Tes mendengarkan akan dimulai secara bersamaan untuk semua peserta melalui siaran pusat.",
        beginBtn: "MULAI UJIAN",
        backBtn: "◀ KEMBALI",
        subtitle: "MASUKKAN INFORMASI KANDIDAT",
        regNoLabel: "NOMOR PENDAFTARAN",
        nameLabel: "NAMA KANDIDAT"
    },
    vi: {
        standby: "HỆ THỐNG CHỜ",
        timeLimit: "THỜI GIAN",
        min: "PHÚT",
        totalQs: "TỔNG SỐ CÂU HỎI",
        qs: "Câu",
        instruction: "HƯỚNG DẪN",
        instText: "Vui lòng đợi cho đến khi giám thị yêu cầu bắt đầu.<br>Phần thi nghe sẽ bắt đầu đồng thời cho tất cả thí sinh qua hệ thống phát thanh trung tâm.",
        beginBtn: "BẮT ĐẦU THI",
        backBtn: "◀ QUAY LẠI",
        subtitle: "NHẬP THÔNG TIN THÍ SINH",
        regNoLabel: "SỐ BÁO DANH",
        nameLabel: "TÊN THÍ SINH"
    },
    ne: {
        standby: "प्रणाली तयारी अवस्था",
        timeLimit: "समय सीमा",
        min: "मिनेट",
        totalQs: "कुल प्रश्नहरू",
        qs: "प्रश्न",
        instruction: "निर्देशन",
        instText: "कृपया निरीक्षकले सुरु गर्न निर्देशन नदिएसम्म पर्खनुहोस्।<br>सुन्ने परीक्षा केन्द्रीय प्रसारण मार्फत सबै उम्मेद्वारहरूको लागि एकै साथ सुरु हुनेछ।",
        beginBtn: "परीक्षा सुरु गर्नुहोस्",
        backBtn: "◀ पछाडि जानुहोस्",
        subtitle: "उम्मेदवार जानकारी प्रविष्ट गर्नुहोस्",
        regNoLabel: "दर्ता नम्बर",
        nameLabel: "उम्मेदवारको नाम"
    }
};

export const getTranslation = (lang: string) => {
  return i18n[lang as keyof typeof i18n] || i18n.en;
};
