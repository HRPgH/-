'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bus, Bell, Key, User, ShieldCheck, AlertTriangle, BookOpen, Info, Plus, Trash2, Users, Send, MessageSquare, X, Megaphone, CheckCircle, CalendarDays, FileSpreadsheet, CheckSquare, Square, UserCog, Bot, Phone, FileText, Check, Search, UserMinus, UserCheck, LogOut, ChevronLeft, ChevronRight, Clock, Download, Smartphone, Monitor } from 'lucide-react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const WORK_PART_OPTIONS = [
  '생산 1,2팀',
  '생산 1팀',
  '생산 2팀',
  '물류팀',
  '생계물류팀',
  '생산지원팀',
] as const;

const getSupabaseClient = (): SupabaseClient | null => {
  const url = "https://aqcyvftecwqnlpotssdh.supabase.co"; 
  const key = "sb_publishable_Sg4l3u7NxxQBPEw_ROmHgA_Btfbj67f"; 
  if (!url || !key) return null;
  return createClient(url, key);
};

const supabase = getSupabaseClient();

function sanitizeInput(text: string): string {
  if (!text) return '';
  return text.trim().replace(/[&<>"']/g, (m) => {
    const map: { [key: string]: string } = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return map[m] || m;
  });
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getAvailabilityDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getConfirmedSelectionKey(date: string, workerKey: string) {
  return `${date}::${workerKey}`;
}

function formatDateLabel(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function getNextWorkDateInfo() {
  const today = new Date();
  let next = new Date(today);
  next.setDate(today.getDate() + 1);

  if (next.getDay() === 6) next.setDate(next.getDate() + 2);
  else if (next.getDay() === 0) next.setDate(next.getDate() + 1);

  const month = next.getMonth() + 1;
  const date = next.getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${month}월 ${date}일 ${days[next.getDay()]}요일`;
}

function getPartFromResidence(residence: string): string | null {
  const normalizedResidence = residence.replace(/\s/g, '');
  if (['문경', '상주'].some((city) => normalizedResidence.includes(city))) return '생산 1,2팀';
  if (['김천', '구미'].some((city) => normalizedResidence.includes(city))) return '생산 2팀';
  return null;
}

function getBotResponse(userMsg: string): string {
  const msg = userMsg.toLowerCase();
  if (msg.includes('셔틀') || msg.includes('버스') || msg.includes('노선')) return '🚌 [(주)올품 AI안내] 셔틀버스는 주간조(07:10/07:15) 및 야간조(22:10) 노선으로 운행됩니다. 상세 승차 위치는 메인 화면의 [🚌 셔틀 노선표] 버튼을 확인해 주세요.\n\n☎️ 기타 문의: 054-450-8618';
  if (msg.includes('시간') || msg.includes('출근') || msg.includes('퇴근')) return '⏰ [(주)올품 AI안내] 근무시간 안내입니다.\n• 주간조: 08:30 ~ 17:30\n• 야간조: 23:30 ~ 08:30\n※ 출근 시간 10분 전까지 도착하여 준비 부탁드립니다.\n\n☎️ 기타 문의: 054-450-8618';
  if (msg.includes('주소') || msg.includes('위치') || msg.includes('올품')) return '📍 [(주)올품 AI안내] 사업장 주소는 [경상북도 상주시 발산로 135 (올품 본사)] 입니다.\n\n☎️ 담당 관리자: 054-450-8618';
  if (msg.includes('급여') || msg.includes('월급') || msg.includes('돈')) return '💰 [(주)올품 AI안내] 급여 지급일은 [매월 10일] 입니다. (휴일일 경우 전일 지급)\n\n☎️ 급여 상세 문의: 054-450-8618';
  if (msg.includes('서류') || msg.includes('준비물') || msg.includes('복장')) return '📝 [(주)올품 AI안내] 첫 출근 시 [신분증 사본, 보건증 사본, 주민등록등본]을 지참해 주세요. 상세 내용은 [첫 출근 가이드]를 확인해 주세요.\n\n☎️ 담당 관리자: 054-450-8618';
  if (msg.includes('안녕') || msg.includes('반가')) return '🤖 안녕하세요! (주)올품 출근 안내 챗봇입니다. 셔틀버스, 첫 출근 서류, 근무시간, 주소 등을 물어보세요.\n\n상세 문의는 담당 관리자(☎️ 054-450-8618)로 연락 바랍니다.';
  return '🤖 말씀해 주신 내용은 챗봇으로 답변하기 어렵습니다.\n\n상세한 문의 사항은 담당 관리자 번호(☎️ 054-450-8618)로 연락 주시면 친절히 안내해 드리겠습니다!';
}

interface MemberItem { idKey: string; name: string; code: string; part: string; isJoined?: boolean; isNoShow?: boolean; resignedAt?: string | null; withdrawnAt?: string | null; isOnline?: boolean; lastLoginAt?: string | null; scheduledWorkDate?: string | null; }
interface MessageItem { id?: number; sender_name: string; sender_role: 'worker' | 'admin'; receiver_name: string; message: string; is_read?: boolean; created_at?: string; }
interface AnnouncementItem { id: number; title: string; content: string; created_at: string; }
interface AvailabilityItem { worker_name: string; status: 'possible' | 'impossible'; created_at: string; }
type WorkerIncomingNotification =
  | { type: 'message'; message: MessageItem }
  | { type: 'announcement'; announcement: AnnouncementItem };

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [role, setRole] = useState<'worker' | 'admin'>('worker');
  const [adminViewTab, setAdminViewTab] = useState<'worker' | 'admin'>('admin');
  const [isAdminPcView, setIsAdminPcView] = useState<boolean>(false);

  const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfZdBbWY7B26JVyus9qlmglVFNh-oZ791GCFU9MJ0-5wu28tw/viewform?usp=dialog";

  const [memberDb, setMemberDb] = useState<{ [idKey: string]: MemberItem }>({});
  const [savingMemberPartKey, setSavingMemberPartKey] = useState<string | null>(null);
  const [adminDb, setAdminDb] = useState<{ [key: string]: true }>({});

  const [memberSearchTerm, setMemberSearchTerm] = useState<string>('');
  const [adminMemberTab, setAdminMemberTab] = useState<'applicants' | 'joined' | 'resigned' | 'noShow' | 'withdrawn'>('applicants');
  const [memberConnectionFilter, setMemberConnectionFilter] = useState<'all' | 'recorded' | 'online' | 'offline'>('all');
  const [showAdminManageModal, setShowAdminManageModal] = useState<boolean>(false);
  const [newAdminName, setNewAdminName] = useState<string>('');
  const [newAdminPassword, setNewAdminPassword] = useState<string>('');

  const [selectedMembers, setSelectedMembers] = useState<{ [idKey: string]: boolean }>({});
  const [scheduledWorkDateInputs, setScheduledWorkDateInputs] = useState<{ [responseDate: string]: string }>({});
  const [scheduledRosterDateInputs, setScheduledRosterDateInputs] = useState<{ [idKey: string]: string }>({});
  const [isSavingScheduledWorkDate, setIsSavingScheduledWorkDate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showAddMemberModal, setShowAddMemberModal] = useState<boolean>(false);
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberCode, setNewMemberCode] = useState<string>('');
  const [newMemberPart, setNewMemberPart] = useState<string>(WORK_PART_OPTIONS[0]);

  const [showBroadcastModal, setShowBroadcastModal] = useState<boolean>(false);
  const [broadcastNotice, setBroadcastNotice] = useState<string>('');
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [showAnnouncePopup, setShowAnnouncePopup] = useState<boolean>(false);
  const [hasUnreadAnnounce, setHasUnreadAnnounce] = useState<boolean>(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState<boolean>(false);

  const [showConfirmedModal, setShowConfirmedModal] = useState<boolean>(false);
  const [showScheduledRosterModal, setShowScheduledRosterModal] = useState<boolean>(false);
  const [selectedScheduledRosterMembers, setSelectedScheduledRosterMembers] = useState<{ [idKey: string]: boolean }>({});
  const [selectedConfirmedMembers, setSelectedConfirmedMembers] = useState<{ [idKey: string]: boolean }>({});
  const [showGroupMsgModal, setShowGroupMsgModal] = useState<boolean>(false);
  const [groupMsgText, setGroupMsgText] = useState<string>('');
  const [groupMessageRecipientKeys, setGroupMessageRecipientKeys] = useState<string[]>([]);

  const [showLoginHistoryModal, setShowLoginHistoryModal] = useState<boolean>(false);
  const [historyTargetKey, setHistoryTargetKey] = useState<string>('');
  const [showAppSelectModal, setShowAppSelectModal] = useState<boolean>(false);

  const [loginName, setLoginName] = useState<string>('');
  const [loginCode, setLoginCode] = useState<string>('');
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [isLockedOut, setIsLockedOut] = useState<boolean>(false);
  const [selectedAvailabilityDate, setSelectedAvailabilityDate] = useState<string>(() => getAvailabilityDateKey());
  const [showAvailabilitySummary, setShowAvailabilitySummary] = useState<boolean>(false);
  const [availabilityRecords, setAvailabilityRecords] = useState<AvailabilityItem[]>([]);
  const [isSavingAvailability, setIsSavingAvailability] = useState<boolean>(false);
  const availabilityFetchInProgress = useRef(false);
  const availabilitySwipeStart = useRef<{ x: number; y: number } | null>(null);

  const shiftAvailabilityDate = (dayOffset: -1 | 1) => {
    if (selectedAvailabilityDate === 'all') return;
    const [year, month, day] = selectedAvailabilityDate.split('-').map(Number);
    const nextDate = new Date(year, month - 1, day + dayOffset);
    const nextDateKey = [
      nextDate.getFullYear(),
      String(nextDate.getMonth() + 1).padStart(2, '0'),
      String(nextDate.getDate()).padStart(2, '0'),
    ].join('-');
    setSelectedAvailabilityDate(nextDateKey);
    setSelectedConfirmedMembers({});
  };

  const handleAvailabilitySwipeStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (
      event.touches.length !== 1 ||
      (event.target instanceof HTMLElement && event.target.closest('button, input, select, textarea'))
    ) {
      availabilitySwipeStart.current = null;
      return;
    }
    const touch = event.touches[0];
    availabilitySwipeStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleAvailabilitySwipeEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = availabilitySwipeStart.current;
    availabilitySwipeStart.current = null;
    if (!start || selectedAvailabilityDate === 'all' || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;

    shiftAvailabilityDate(deltaX > 0 ? -1 : 1);
  };

  const [userName, setUserName] = useState<string>('');
  const [userCode, setUserCode] = useState<string>('');
  const [userPart, setUserPart] = useState<string>('');

  const [showChatModal, setShowChatModal] = useState<boolean>(false);
  const [chatTargetWorkerKey, setChatTargetWorkerKey] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<MessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);
  const chatScrollStateRef = useRef({ isOpen: false, target: '', messageCount: 0 });
  const [unreadCounts, setUnreadCounts] = useState<{ [idKey: string]: number }>({});
  const [latestWorkerMessageAt, setLatestWorkerMessageAt] = useState<{ [idKey: string]: string }>({});
  const [unreadWorkerMessages, setUnreadWorkerMessages] = useState<{ [idKey: string]: MessageItem }>({});
  const [adminIncomingMessage, setAdminIncomingMessage] = useState<MessageItem | null>(null);
  const [workerIncomingNotification, setWorkerIncomingNotification] = useState<WorkerIncomingNotification | null>(null);
  const [showAdminNotificationMenu, setShowAdminNotificationMenu] = useState<boolean>(false);

  const [activeModal, setActiveModal] = useState<'shuttle' | 'guide' | 'resignation' | null>(null);
  const [isFirstLoginGuide, setIsFirstLoginGuide] = useState(false);
  const welcomeMessageRequests = useRef(new Set<string>());
  const seenWorkerMessageIds = useRef(new Set<number>());
  const hasInitializedAdminMessages = useRef(false);
  const seenAdminMessageIds = useRef(new Set<number>());
  const hasInitializedWorkerMessages = useRef(false);
  const seenAnnouncementIds = useRef(new Set<number>());
  const hasInitializedWorkerAnnouncements = useRef(false);

  const userUniqueKey = `${userName}_${userCode}`;
  useEffect(() => {
    const target = role === 'admin' ? chatTargetWorkerKey : userUniqueKey;
    const previous = chatScrollStateRef.current;
    const shouldScroll = showChatModal && (
      !previous.isOpen ||
      previous.target !== target ||
      chatMessages.length > previous.messageCount
    );
    const behavior: ScrollBehavior = previous.isOpen && previous.target === target ? 'smooth' : 'auto';
    chatScrollStateRef.current = { isOpen: showChatModal, target, messageCount: chatMessages.length };

    if (shouldScroll) {
      requestAnimationFrame(() => {
        const container = chatMessagesContainerRef.current;
        if (container) container.scrollTo({ top: container.scrollHeight, behavior });
      });
    }
  }, [showChatModal, role, chatTargetWorkerKey, userUniqueKey, chatMessages.length]);

  const latestAvailabilityDate = useMemo(() => {
    return availabilityRecords.reduce((latestDate, record) => {
      const recordDate = getAvailabilityDateKey(new Date(record.created_at));
      return recordDate > latestDate ? recordDate : latestDate;
    }, getAvailabilityDateKey());
  }, [availabilityRecords]);
  const responseDate = role === 'admin'
    ? selectedAvailabilityDate === 'all' ? latestAvailabilityDate : selectedAvailabilityDate
    : getAvailabilityDateKey();
  const workerResponses = useMemo(() => {
    const responses: { [idKey: string]: 'possible' | 'impossible' | 'none' } = {};
    availabilityRecords.forEach((record) => {
      if (getAvailabilityDateKey(new Date(record.created_at)) === responseDate) {
        responses[record.worker_name] = record.status;
      }
    });
    return responses;
  }, [availabilityRecords, responseDate]);
  const availabilityByDate = useMemo(() => {
    const responsesByDate: {
      [date: string]: { [workerKey: string]: 'possible' | 'impossible' };
    } = {};
    const scheduledByDate: { [date: string]: string[] } = {};

    availabilityRecords.forEach((record) => {
      const date = getAvailabilityDateKey(new Date(record.created_at));
      if (!responsesByDate[date]) responsesByDate[date] = {};
      responsesByDate[date][record.worker_name] = record.status;
    });

    Object.entries(memberDb).forEach(([workerKey, member]) => {
      if (!member.scheduledWorkDate) return;
      if (!scheduledByDate[member.scheduledWorkDate]) scheduledByDate[member.scheduledWorkDate] = [];
      scheduledByDate[member.scheduledWorkDate].push(workerKey);
    });

    return Array.from(new Set([
      getAvailabilityDateKey(),
      ...Object.keys(responsesByDate),
      ...Object.keys(scheduledByDate),
    ]))
      .sort((dateA, dateB) => dateB.localeCompare(dateA))
      .map((date) => {
        const responses = responsesByDate[date] || {};
        return {
          date,
          responses,
          possible: Object.keys(responses).filter((workerKey) => responses[workerKey] === 'possible'),
          impossible: Object.keys(responses).filter((workerKey) => responses[workerKey] === 'impossible'),
          scheduled: scheduledByDate[date] || [],
        };
      });
  }, [availabilityRecords, memberDb]);
  const availabilityDates = useMemo(() => {
    const dates = new Set([getAvailabilityDateKey()]);
    availabilityRecords.forEach((record) => dates.add(getAvailabilityDateKey(new Date(record.created_at))));
    Object.values(memberDb).forEach((member) => {
      if (member.scheduledWorkDate) dates.add(member.scheduledWorkDate);
    });
    if (selectedAvailabilityDate !== 'all') dates.add(selectedAvailabilityDate);
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [availabilityRecords, memberDb, selectedAvailabilityDate]);
  const scheduledRosterDates = availabilityByDate.filter(({ scheduled }) => scheduled.length > 0);
  const scheduledRosterCount = scheduledRosterDates.reduce((count, { scheduled }) => count + scheduled.length, 0);
  const scheduledRosterMemberKeys = scheduledRosterDates.flatMap(({ scheduled }) => scheduled);
  const selectedScheduledRosterKeys = scheduledRosterMemberKeys.filter((idKey) => selectedScheduledRosterMembers[idKey]);

  const navigateToStore = (osType: 'android' | 'ios') => {
    setShowAppSelectModal(false);
    if (osType === 'android') {
      window.location.href = "https://play.google.com/store/apps/details?id=com.pb.mobile&pcampaignid=web_share";
    } else {
      window.location.href = "https://apps.apple.com/kr/app/mobile-hr/id1216520471";
    }
  };

  const fetchAdmins = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('admins').select('name');
      if (data && !error) {
        const aMap: { [key: string]: true } = {};
        data.forEach((item: { name: string }) => { aMap[item.name] = true; });
        setAdminDb(aMap);
      }
    } catch (err) {}
  };

  const fetchMembers = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('members').select('*');
      if (data && !error) {
        const dbMap: { [idKey: string]: MemberItem } = {};
        data.forEach((item: any) => {
          const idKey = `${item.name}_${item.code}`;
          dbMap[idKey] = {
            idKey, name: item.name, code: item.code, part: item.part,
            isJoined: item.is_joined === true, isNoShow: item.is_no_show === true,
            resignedAt: item.resigned_at || null,
            withdrawnAt: item.withdrawn_at || null,
            isOnline: item.is_online === true, lastLoginAt: item.last_login_at,
            scheduledWorkDate: item.scheduled_work_date || null
          };
        });
        setMemberDb(dbMap);
      }
    } catch (err) {}
  };

  const fetchCounts = async () => {
    if (!supabase || availabilityFetchInProgress.current) return;
    availabilityFetchInProgress.current = true;
    try {
      const { data: availData, error } = await supabase
        .from('work_availabilities')
        .select('worker_name, status, created_at')
        .order('created_at', { ascending: true });
      if (error) {
        console.error('출근 응답 기록 조회 실패:', error.message);
        return;
      }
      if (!availData) return;

      const todayDate = getAvailabilityDateKey();
      const todayImpossibleWorkers = Array.from(new Set(
        availData
          .filter((record) =>
            record.status === 'impossible' &&
            getAvailabilityDateKey(new Date(record.created_at)) === todayDate
          )
          .map((record) => record.worker_name)
      ));
      let hasReconciledRecords = false;

      for (const workerKey of todayImpossibleWorkers) {
        const previousRecords = availData
          .filter((record) =>
            record.worker_name === workerKey &&
            getAvailabilityDateKey(new Date(record.created_at)) < todayDate
          )
          .sort((recordA, recordB) => recordB.created_at.localeCompare(recordA.created_at));
        const latestPreviousRecord = previousRecords[0];
        if (!latestPreviousRecord) continue;

        const previousDate = getAvailabilityDateKey(new Date(latestPreviousRecord.created_at));
        if (latestPreviousRecord.status === 'possible') {
          const previousDateStart = new Date(`${previousDate}T00:00:00+09:00`);
          const previousDateEnd = new Date(previousDateStart);
          previousDateEnd.setUTCDate(previousDateEnd.getUTCDate() + 1);
          const { error: updateError } = await supabase
            .from('work_availabilities')
            .update({ status: 'impossible' })
            .eq('worker_name', workerKey)
            .eq('status', 'possible')
            .gte('created_at', previousDateStart.toISOString())
            .lt('created_at', previousDateEnd.toISOString());

          if (updateError) {
            console.error(`이전 출근 가능 응답을 출근 어려움으로 변경하지 못했습니다 (${workerKey}):`, updateError.message);
            continue;
          }
        }

        const todayDateStart = new Date(`${todayDate}T00:00:00+09:00`);
        const todayDateEnd = new Date(todayDateStart);
        todayDateEnd.setUTCDate(todayDateEnd.getUTCDate() + 1);
        const { error: deleteError } = await supabase
          .from('work_availabilities')
          .delete()
          .eq('worker_name', workerKey)
          .eq('status', 'impossible')
          .gte('created_at', todayDateStart.toISOString())
          .lt('created_at', todayDateEnd.toISOString());

        if (deleteError) {
          console.error(`중복된 오늘 출근 어려움 응답을 정리하지 못했습니다 (${workerKey}):`, deleteError.message);
          continue;
        }
        hasReconciledRecords = true;
      }

      if (hasReconciledRecords) {
        const { data: refreshedRecords, error: refreshError } = await supabase
          .from('work_availabilities')
          .select('worker_name, status, created_at')
          .order('created_at', { ascending: true });
        if (refreshError) {
          console.error('정리된 출근 응답 기록을 다시 조회하지 못했습니다:', refreshError.message);
          setAvailabilityRecords(availData);
          return;
        }
        if (refreshedRecords) {
          setAvailabilityRecords(refreshedRecords);
          return;
        }
      }

      setAvailabilityRecords(availData);
    } catch (error) {
      console.error('출근 응답 기록 조회 실패:', error);
    } finally {
      availabilityFetchInProgress.current = false;
    }
  };

  const fetchMessages = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
      if (data && !error) {
        const counts: { [idKey: string]: number } = {};
        const latestUnreadWorkerMessages: { [idKey: string]: MessageItem } = {};
        const latestWorkerMessages: { [idKey: string]: string } = {};
        const workerMessages = data.filter(
          (msg: MessageItem): msg is MessageItem & { id: number } =>
            msg.sender_role === 'worker' && typeof msg.id === 'number'
        );
        const adminMessagesForWorker = data.filter(
          (msg: MessageItem): msg is MessageItem & { id: number } =>
            msg.sender_role === 'admin' && msg.receiver_name === userUniqueKey && typeof msg.id === 'number'
        );
        if (role === 'admin') {
          if (!hasInitializedAdminMessages.current) {
            workerMessages.forEach((msg) => seenWorkerMessageIds.current.add(msg.id));
            hasInitializedAdminMessages.current = true;
          } else {
            const newMessages = workerMessages.filter((msg) => !seenWorkerMessageIds.current.has(msg.id));
            workerMessages.forEach((msg) => seenWorkerMessageIds.current.add(msg.id));
            const latestNewMessage = newMessages[newMessages.length - 1];
            if (latestNewMessage) setAdminIncomingMessage(latestNewMessage);
          }
        } else if (role === 'worker') {
          if (!hasInitializedWorkerMessages.current) {
            adminMessagesForWorker.forEach((msg) => seenAdminMessageIds.current.add(msg.id));
            hasInitializedWorkerMessages.current = true;
          } else {
            const newMessages = adminMessagesForWorker.filter((msg) => !seenAdminMessageIds.current.has(msg.id));
            adminMessagesForWorker.forEach((msg) => seenAdminMessageIds.current.add(msg.id));
            const latestNewMessage = newMessages[newMessages.length - 1];
            if (latestNewMessage) setWorkerIncomingNotification({ type: 'message', message: latestNewMessage });
          }
        }
        data.forEach((msg: MessageItem) => {
          if (msg.sender_role === 'worker' && msg.created_at) {
            const latestAt = latestWorkerMessages[msg.sender_name];
            if (!latestAt || msg.created_at > latestAt) {
              latestWorkerMessages[msg.sender_name] = msg.created_at;
            }
          }
          if (!msg.is_read) {
            if (role === 'admin' && msg.sender_role === 'worker') { counts[msg.sender_name] = (counts[msg.sender_name] || 0) + 1; }
            else if (role === 'worker' && msg.receiver_name === userUniqueKey) { counts['admin'] = (counts['admin'] || 0) + 1; }
          }
          if (role === 'admin' && msg.sender_role === 'worker' && !msg.is_read) {
            const latestUnread = latestUnreadWorkerMessages[msg.sender_name];
            if (!latestUnread?.created_at || (msg.created_at && msg.created_at > latestUnread.created_at)) {
              latestUnreadWorkerMessages[msg.sender_name] = msg;
            }
          }
        });
        setUnreadCounts(counts);
        setUnreadWorkerMessages(latestUnreadWorkerMessages);
        setLatestWorkerMessageAt(latestWorkerMessages);

        const currentTarget = role === 'admin' ? chatTargetWorkerKey : userUniqueKey;
        const filtered = data.filter((msg: MessageItem) => msg.sender_name === currentTarget || msg.receiver_name === currentTarget);
        setChatMessages(filtered);
      }
    } catch (err) {}
  };

  const fetchAnnouncements = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (data && !error) {
        setAnnouncements(data);
        if (role === 'worker') {
          if (!hasInitializedWorkerAnnouncements.current) {
            data.forEach((announcement: AnnouncementItem) => seenAnnouncementIds.current.add(announcement.id));
            hasInitializedWorkerAnnouncements.current = true;
          } else {
            const newAnnouncement = data.find((announcement: AnnouncementItem) => !seenAnnouncementIds.current.has(announcement.id));
            data.forEach((announcement: AnnouncementItem) => seenAnnouncementIds.current.add(announcement.id));
            if (newAnnouncement) {
              setWorkerIncomingNotification({ type: 'announcement', announcement: newAnnouncement });
            }
          }
        }
        const lastReadId = localStorage.getItem(`read_announcement_${userUniqueKey}`);
        setHasUnreadAnnounce(data.length > 0 && String(data[0].id) !== lastReadId);
      }
    } catch (err) {}
  };

  const handleDeleteAnnouncement = async (announceId: number) => {
    if (confirm('해당 공지사항을 삭제하시겠습니까?')) {
      if (!supabase) {
        alert('공지사항을 삭제할 수 없습니다. DB 연결을 확인해 주세요.');
        return;
      }

      const { error } = await supabase.from('announcements').delete().eq('id', announceId);
      if (error) {
        alert(`공지사항 삭제에 실패했습니다: ${error.message}`);
        return;
      }
      await fetchAnnouncements();
    }
  };

  const markAsRead = async (targetWorkerKey: string) => {
    if (!supabase) return;
    try {
      if (role === 'admin') {
        await supabase.from('messages').update({ is_read: true }).eq('sender_name', targetWorkerKey).eq('is_read', false);
      } else {
        await supabase.from('messages').update({ is_read: true }).eq('receiver_name', userUniqueKey).eq('is_read', false);
      }
      fetchMessages();
    } catch (err) {}
  };

  const openAnnouncementBell = () => {
    setShowNotificationMenu(false);
    setShowAdminNotificationMenu(false);
    setShowAnnouncePopup(true);
    setHasUnreadAnnounce(false);
    if (announcements.length > 0) { localStorage.setItem(`read_announcement_${userUniqueKey}`, String(announcements[0].id)); }
  };

  const checkAndCreateWelcomeMessage = async (targetUserKey: string) => {
    if (!supabase || !targetUserKey || targetUserKey === '_' || welcomeMessageRequests.current.has(targetUserKey)) return;
    welcomeMessageRequests.current.add(targetUserKey);
    try {
      const welcomeMsg = '🤖 안녕하세요! (주)올품 출근 안내 챗봇입니다. 셔틀버스, 첫 출근 서류, 근무시간, 주소 등을 물어보세요.\n\n상세 문의는 담당 관리자(☎️ 054-450-8618)로 연락 바랍니다.';
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('sender_name', '관리자')
        .eq('sender_role', 'admin')
        .eq('receiver_name', targetUserKey)
        .eq('message', welcomeMsg)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('챗봇 첫 인사 확인 실패:', error.message);
        return;
      }

      if (!data || data.length === 0) {
        const { error: insertError } = await supabase.from('messages').insert([
          { sender_name: '관리자', sender_role: 'admin', receiver_name: targetUserKey, message: welcomeMsg, is_read: false }
        ]);
        if (insertError) {
          console.error('챗봇 첫 인사 등록 실패:', insertError.message);
          return;
        }
      } else if (data.length > 1) {
        const duplicateIds = data.slice(1).map((message) => message.id);
        const { error: deleteError } = await supabase
          .from('messages')
          .delete()
          .in('id', duplicateIds);
        if (deleteError) {
          console.error('중복된 챗봇 첫 인사 삭제 실패:', deleteError.message);
        }
      }

      await fetchMessages();
    } catch (error) {
      console.error('챗봇 첫 인사 처리 실패:', error);
    } finally {
      welcomeMessageRequests.current.delete(targetUserKey);
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetchMembers();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchAdmins(); fetchMembers(); fetchCounts(); fetchMessages(); fetchAnnouncements();

      if (role === 'worker' && userName && userCode) {
        checkAndCreateWelcomeMessage(userUniqueKey);
      }

      const interval = setInterval(() => {
        fetchAdmins(); fetchMembers(); fetchCounts(); fetchMessages(); fetchAnnouncements();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, role, chatTargetWorkerKey, showChatModal, userName, userCode]);

  useEffect(() => {
    if (isLoggedIn && role === 'worker' && showChatModal) { markAsRead(userUniqueKey); }
    else if (isLoggedIn && role === 'admin' && showChatModal) { markAsRead(chatTargetWorkerKey); }
  }, [showChatModal, chatTargetWorkerKey, isLoggedIn, role]);

  const handleLogin = async (selectedRole: 'worker' | 'admin') => {
    if (isLockedOut) { alert('🔒 5회 연속 오류로 계정이 잠겼습니다.'); return; }

    const cleanName = sanitizeInput(loginName);
    const cleanCode = loginCode.trim();

    if (!cleanName || !cleanCode) { alert('성명과 개인 전용 코드를 입력하세요.'); return; }

    if (!supabase) {
      alert('⚠️ Supabase DB 연동 설정에 실패하였습니다. 설정 주소/키를 확인해 주세요.');
      return;
    }

    if (selectedRole === 'admin') {
      const { data: isAdminAuthenticated, error } = await supabase.rpc('verify_admin_login', {
        p_name: cleanName,
        p_password: cleanCode,
      });

      if (error) {
        alert(`⚠️ DB 연동 에러가 발생했습니다: ${error.message}`);
        return;
      }

      if (isAdminAuthenticated === true) {
        setUserName(cleanName); setUserCode('ADMIN'); setRole('admin'); setAdminViewTab('admin'); setIsLoggedIn(true); setFailedAttempts(0); return;
      } else {
        const nextFailed = failedAttempts + 1; setFailedAttempts(nextFailed);
        if (nextFailed >= 5) setIsLockedOut(true);
        alert(`⚠️ 관리자 계정 성명 또는 비밀번호가 일치하지 않습니다. (${nextFailed}/5회)`); return;
      }
    }

    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('name', cleanName)
      .eq('code', cleanCode)
      .maybeSingle();

    if (memberError) {
      alert(`⚠️ DB 연동 에러가 발생했습니다: ${memberError.message}`);
      return;
    }

    if (!memberData) {
      const nextFailed = failedAttempts + 1; setFailedAttempts(nextFailed);
      alert(`⚠️ 등록되지 않은 성명이거나 개인 전용 코드가 일치하지 않습니다. (${nextFailed}/5회)`);
      if (nextFailed >= 5) setIsLockedOut(true); return;
    }

    if (memberData.withdrawn_at) {
      alert('탈퇴 처리된 계정입니다. 다시 이용하려면 관리자에게 문의해 주세요.');
      return;
    }

    const nowIso = new Date().toISOString();
    const { error: statusError } = await supabase
      .from('members')
      .update({ is_online: true, last_login_at: nowIso })
      .match({ name: cleanName, code: cleanCode });
    if (statusError) {
      alert(`⚠️ 접속 상태를 기록하지 못했지만 로그인을 계속합니다. ${statusError.message}`);
    }

    const workerKey = `${cleanName}_${cleanCode}`;
    setUserName(cleanName); setUserCode(cleanCode); setUserPart(memberData.part); setRole('worker'); setIsLoggedIn(true); setFailedAttempts(0);

    const guideAccountKey = workerKey;
    const guideNeverKey = `first_guide_never_show_${guideAccountKey}`;
    const guideHiddenTodayKey = `first_guide_hidden_date_${guideAccountKey}`;
    const shouldShowGuide =
      !localStorage.getItem(guideNeverKey) &&
      localStorage.getItem(guideHiddenTodayKey) !== getLocalDateKey();
    if (shouldShowGuide) {
      setIsFirstLoginGuide(!localStorage.getItem(`first_guide_confirmed_${guideAccountKey}`));
      setActiveModal('guide');
    } else {
      setIsFirstLoginGuide(false);
    }
  };

  const handleLogout = async () => {
    if (role === 'worker' && userName && userCode && supabase) {
      const { error } = await supabase
        .from('members')
        .update({ is_online: false })
        .match({ name: userName, code: userCode });
      if (error) {
        alert(`⚠️ 로그아웃 상태를 DB에 저장하지 못했습니다. 관리자에게 알려주세요. ${error.message}`);
      }
      await fetchMembers();
    }
    setIsLoggedIn(false); setLoginName(''); setLoginCode('');
  };

  const handleWorkerSelfDelete = async () => {
    if (confirm(`⚠️ 정말로 탈퇴하시겠습니까?\n\n탈퇴하면 계정은 비활성화되고 관리자의 탈퇴 명단에 기록됩니다.`)) {
      if (!supabase) {
        alert('DB 연결에 실패하여 탈퇴 처리할 수 없습니다.');
        return;
      }
      const { error } = await supabase.from('members')
        .update({ withdrawn_at: new Date().toISOString(), is_online: false })
        .match({ name: userName, code: userCode });
      if (error) {
        alert(`탈퇴 처리에 실패했습니다: ${error.message}`);
        return;
      }
      alert('탈퇴가 완료되었습니다.');
      setActiveModal(null);
      setIsLoggedIn(false);
      setLoginName('');
      setLoginCode('');
      setUserName('');
      setUserCode('');
      await fetchMembers();
    }
  };

  const restoreWithdrawnMember = async (idKey: string) => {
    const target = memberDb[idKey];
    if (!target || !supabase) return;
    const { error } = await supabase.from('members')
      .update({ withdrawn_at: null, resigned_at: null, is_joined: false, is_no_show: false })
      .match({ name: target.name, code: target.code });
    if (error) {
      alert(`탈퇴 상태 해제에 실패했습니다: ${error.message}`);
      return;
    }
    await fetchMembers();
  };

  const toggleJoinStatus = async (idKey: string) => {
    const target = memberDb[idKey];
    if (!target || !supabase) return;
    const nextStatus = !target.isJoined;
    const { error } = await supabase.from('members')
      .update({ is_joined: nextStatus, is_no_show: false, resigned_at: null })
      .match({ name: target.name, code: target.code });
    if (error) {
      alert(`입사 상태 변경에 실패했습니다: ${error.message}`);
      return;
    }
    await fetchMembers();
  };

  const toggleResignedStatus = async (idKey: string) => {
    const target = memberDb[idKey];
    if (!target || !supabase) return;
    const isResigning = !target.resignedAt;
    const { error } = await supabase.from('members')
      .update({
        is_joined: false,
        is_no_show: false,
        resigned_at: isResigning ? new Date().toISOString() : null,
      })
      .match({ name: target.name, code: target.code });
    if (error) {
      alert(`퇴사 상태 변경에 실패했습니다: ${error.message}`);
      return;
    }
    await fetchMembers();
  };

  const toggleNoShowStatus = async (idKey: string) => {
    const target = memberDb[idKey];
    if (!target || !supabase) return;
    const nextStatus = !target.isNoShow;
    const { error } = await supabase.from('members')
      .update({ is_no_show: nextStatus, is_joined: false, resigned_at: null })
      .match({ name: target.name, code: target.code });
    if (error) {
      alert(`노쇼 상태 변경에 실패했습니다: ${error.message}`);
      return;
    }
    await fetchMembers();
  };

  const handleSendGroupMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = groupMsgText.trim();
    const selectedKeys = groupMessageRecipientKeys;

    if (!text || selectedKeys.length === 0 || !supabase) return;

    const msgBatch = selectedKeys.map(k => ({ sender_name: '관리자', sender_role: 'admin', receiver_name: k, message: text, is_read: false }));
    const { error } = await supabase.from('messages').insert(msgBatch);
    if (error) {
      alert(`메시지 전송에 실패했습니다: ${error.message}`);
      return;
    }
    alert(`📩 선택한 ${selectedKeys.length}명에게 메시지가 동시 전송되었습니다.`);
    setGroupMsgText('');
    setGroupMessageRecipientKeys([]);
    setShowGroupMsgModal(false);
    setSelectedMembers({});
    setSelectedScheduledRosterMembers({});
    await fetchMessages();
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeInput(newAdminName);
    const cleanPw = newAdminPassword.trim();
    if (!cleanName || !cleanPw || !supabase) return;

    if (adminDb[cleanName]) { alert(`⚠️ '${cleanName}' 관리자 계정이 이미 존재합니다.`); return; }

    await supabase.from('admins').insert([{ name: cleanName, password: cleanPw }]);
    alert(`🛡️ '${cleanName}' 신규 관리자 계정이 생성되었습니다.`);
    setNewAdminName(''); setNewAdminPassword(''); fetchAdmins();
  };

  const handleDeleteAdmin = async (nameToDelete: string) => {
    if (Object.keys(adminDb).length <= 1) { alert('⚠️ 최소 1개 이상의 관리자 계정이 유지되어야 합니다.'); return; }
    if (confirm(`'${nameToDelete}' 관리자 계정을 삭제하시겠습니까?`) && supabase) {
      await supabase.from('admins').delete().eq('name', nameToDelete);
      fetchAdmins();
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !supabase) return;

    const senderName = role === 'admin' ? '관리자' : userUniqueKey;
    const receiverName = role === 'admin' ? chatTargetWorkerKey : '관리자';
    const text = inputMessage.trim();
    setInputMessage('');

    const { error } = await supabase.from('messages').insert([
      { sender_name: senderName, sender_role: role, receiver_name: receiverName, message: text, is_read: false },
    ]);
    if (error) {
      setInputMessage(text);
      alert(`메시지 전송에 실패했습니다: ${error.message}`);
      return;
    }
    await fetchMessages();

    if (role === 'worker') {
      const autoReply = getBotResponse(text);
      setTimeout(async () => {
        const { error: replyError } = await supabase.from('messages').insert([
          { sender_name: '관리자', sender_role: 'admin', receiver_name: senderName, message: autoReply, is_read: false },
        ]);
        if (replyError) {
          console.error('자동 안내 메시지 전송 실패:', replyError.message);
          return;
        }
        fetchMessages();
      }, 500);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = broadcastNotice.trim();
    if (!text || !supabase) return;

    const { error } = await supabase.from('announcements').insert([
      { title: '전체 공지사항', content: text },
    ]);
    if (error) {
      alert(`공지 등록에 실패했습니다: ${error.message}`);
      return;
    }
    alert('전체 공지가 등록되었습니다!');
    setBroadcastNotice(''); setShowBroadcastModal(false); fetchAnnouncements();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!supabase) {
        alert('⚠️ Supabase DB 연동 설정에 실패하여 명단을 등록할 수 없습니다.');
        return;
      }

      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
      if (!worksheet) {
        alert('⚠️ 파일에서 시트를 찾을 수 없습니다.');
        return;
      }

      const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        raw: true,
        defval: '',
      });
      const normalizeHeader = (value: unknown) =>
        String(value ?? '').replace(/\s/g, '').toLowerCase();
      const findColumns = (suffixOnly: boolean) => {
        for (let rowIndex = 0; rowIndex < Math.min(rows.length, 10); rowIndex++) {
          const headers = rows[rowIndex].map(normalizeHeader);
          const nameIndex = headers.findIndex((header) =>
            ['성명', '이름', '성함'].includes(header)
          );
          const codeIndex = headers.findIndex((header) =>
            suffixOnly
              ? (header.includes('전화번호') && /(뒷자리|끝자리|4자리)/.test(header)) ||
                ['코드', '전용코드', '개인코드'].includes(header)
              : ['전화번호', '연락처', '휴대전화', '휴대폰번호'].includes(header)
          );
          if (nameIndex >= 0 && codeIndex >= 0) {
            const residenceIndex = headers.findIndex((header) =>
              ['거주지', '거주지역', '주소', '거주주소'].includes(header)
            );
            return { headerRowIndex: rowIndex, nameIndex, codeIndex, residenceIndex };
          }
        }
        return null;
      };

      const columns = findColumns(true) ?? findColumns(false);
      const headerRowIndex = columns?.headerRowIndex ?? -1;
      const nameIndex = columns?.nameIndex ?? 0;
      const codeIndex = columns?.codeIndex ?? 1;
      const residenceIndex = columns?.residenceIndex ?? -1;
      const membersByKey = new Map<string, {
        name: string;
        code: string;
        part: string;
        is_joined: boolean;
        is_online: boolean;
      }>();
      const partOverrides = new Map<string, string>();
      let skippedCount = 0;

      rows.forEach((row, rowIndex) => {
        if (rowIndex <= headerRowIndex) return;
        const rawName = String(row[nameIndex] ?? '').replace(/\0/g, '').trim();
        const rawCode = String(row[codeIndex] ?? '').trim();
        if (!rawName && !rawCode) return;

        const cleanName = sanitizeInput(rawName);
        const isValidName = /^[가-힣a-zA-Z0-9\s]+$/.test(cleanName);
        const isValidCode = /^[\d\s()+-]+$/.test(rawCode);
        const digits = rawCode.replace(/\D/g, '');
        if (!isValidName || !isValidCode || !digits) {
          skippedCount++;
          return;
        }

        const code = digits.slice(-4).padStart(4, '0');
        const key = `${cleanName}_${code}`;
        const assignedPart = residenceIndex >= 0
          ? getPartFromResidence(String(row[residenceIndex] ?? '').trim())
          : null;
        const part = assignedPart ?? WORK_PART_OPTIONS[0];
        membersByKey.set(key, {
          name: cleanName,
          code,
          part,
          is_joined: false,
          is_online: false,
        });
        if (assignedPart) partOverrides.set(key, assignedPart);
      });

      const insertBatch = Array.from(membersByKey.values());
      if (insertBatch.length === 0) {
        alert('⚠️ 등록할 명단이 없습니다. 첫 번째 시트에 성명과 전화번호 뒷자리 열이 있는지 확인해 주세요.');
        return;
      }

      const { error } = await supabase
        .from('members')
        .upsert(insertBatch, { onConflict: 'name,code', ignoreDuplicates: true });
      if (error) {
        alert(`명단 등록 중 오류가 발생했습니다: ${error.message}`);
        return;
      }

      let updatedPartsCount = 0;
      const partUpdateErrors: string[] = [];
      const partOverrideEntries = Array.from(partOverrides.entries());
      for (let index = 0; index < partOverrideEntries.length; index++) {
        const [key, part] = partOverrideEntries[index];
        const member = membersByKey.get(key);
        if (!member) continue;
        const { error: updateError } = await supabase
          .from('members')
          .update({ part })
          .match({ name: member.name, code: member.code });
        if (updateError) partUpdateErrors.push(`${member.name}: ${updateError.message}`);
        else updatedPartsCount++;
      }

      await fetchMembers();
      if (partUpdateErrors.length > 0) {
        alert(
          `명단 ${insertBatch.length}명을 등록했지만, 근무파트 변경 ${partUpdateErrors.length}건에 실패했습니다.\n${partUpdateErrors.slice(0, 3).join('\n')}${partUpdateErrors.length > 3 ? '\n외 추가 오류가 있습니다.' : ''}`
        );
        return;
      }

      alert(
        `🎉 총 ${insertBatch.length}명의 명단을 등록했습니다.${updatedPartsCount > 0 ? `\n거주지 기준 근무파트를 ${updatedPartsCount}명에게 배정했습니다.` : ''}${skippedCount > 0 ? `\n확인할 수 없어 제외한 행: ${skippedCount}개` : ''}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      alert(`파일을 읽는 중 오류가 발생했습니다: ${message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleSelectMember = (idKey: string) => { setSelectedMembers(prev => ({ ...prev, [idKey]: !prev[idKey] })); };
  const handleMemberPartChange = async (idKey: string, part: string) => {
    const member = memberDb[idKey];
    if (!member) return;
    if (!supabase) {
      alert('DB 연결에 실패하여 근무 파트를 저장할 수 없습니다.');
      return;
    }
    if (!WORK_PART_OPTIONS.some((option) => option === part)) {
      alert('선택한 근무 파트가 올바르지 않습니다.');
      return;
    }
    if (member.part === part) return;

    setSavingMemberPartKey(idKey);
    try {
      const { error } = await supabase.from('members')
        .update({ part })
        .match({ name: member.name, code: member.code });
      if (error) {
        alert(`근무 파트 변경에 실패했습니다: ${error.message}`);
        return;
      }

      setMemberDb((previous) => ({
        ...previous,
        [idKey]: { ...previous[idKey], part },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      alert(`근무 파트 변경 중 오류가 발생했습니다: ${message}`);
    } finally {
      setSavingMemberPartKey(null);
    }
  };

  const toggleSelectAll = () => {
    const tabKeys = currentTabMemberKeys;
    const isAllSelected = tabKeys.length > 0 && tabKeys.every(idKey => selectedMembers[idKey]);
    setSelectedMembers((previous) => {
      const updated = { ...previous };
      tabKeys.forEach((idKey) => {
        if (isAllSelected) delete updated[idKey];
        else updated[idKey] = true;
      });
      return updated;
    });
  };
  const toggleSelectMembers = (memberKeys: string[]) => {
    const shouldSelect = !memberKeys.every((idKey) => selectedMembers[idKey]);
    setSelectedMembers((previous) => {
      const updated = { ...previous };
      memberKeys.forEach((idKey) => {
        if (shouldSelect) updated[idKey] = true;
        else delete updated[idKey];
      });
      return updated;
    });
  };

  const handleDownloadSelected = () => {
    const selectedMemberKeys = Object.keys(selectedMembers).filter(
      (idKey) => selectedMembers[idKey] && memberDb[idKey]
    );
    if (selectedMemberKeys.length === 0) {
      alert('엑셀로 다운로드할 인원을 선택해 주세요.');
      return;
    }

    const exportRows = selectedMemberKeys.map((idKey) => {
      const member = memberDb[idKey];
      return {
        성명: member.name,
        코드: member.code,
        근무파트: member.part,
        입사상태: member.withdrawnAt ? '탈퇴' : member.resignedAt ? '퇴사' : member.isJoined ? '입사완료' : member.isNoShow ? '노쇼' : '지원자',
        접속상태: member.isOnline ? '접속중' : member.lastLoginAt ? '기록' : '미접속',
        최근접속: member.lastLoginAt || '',
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet['!cols'] = [
      { wch: 14 },
      { wch: 10 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 24 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '선택 명단');

    const today = new Date();
    const dateStamp = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('');
    XLSX.writeFile(workbook, `지원자_선택명단_${dateStamp}.xlsx`);
  };

  const toggleSelectAllConfirmed = () => {
    const shouldSelectAll = !isAllConfirmedSelected;
    setSelectedConfirmedMembers((prev) => {
      const updated = { ...prev };
      confirmedList.forEach((idKey) => {
        const selectionKey = getConfirmedSelectionKey(selectedAvailabilityDate, idKey);
        if (shouldSelectAll) updated[selectionKey] = true;
        else delete updated[selectionKey];
      });
      return updated;
    });
  };

  const toggleSelectAllConfirmedForDate = (date: string, memberKeys: string[]) => {
    const shouldSelectAll = !memberKeys.every(
      (idKey) => selectedConfirmedMembers[getConfirmedSelectionKey(date, idKey)]
    );
    setSelectedConfirmedMembers((prev) => {
      const updated = { ...prev };
      memberKeys.forEach((idKey) => {
        const selectionKey = getConfirmedSelectionKey(date, idKey);
        if (shouldSelectAll) updated[selectionKey] = true;
        else delete updated[selectionKey];
      });
      return updated;
    });
  };

  const downloadConfirmedMembers = (date: string, memberKeys: string[]) => {
    if (memberKeys.length === 0) {
      alert('해당 날짜에 출근 가능으로 응답한 인원이 없습니다.');
      return;
    }

    const exportRows = memberKeys.map((idKey) => {
      const member = memberDb[idKey];
      return {
        응답일: date,
        성명: member?.name || idKey.split('_')[0],
        코드: member?.code || idKey.split('_')[1] || '',
        근무파트: member?.part || WORK_PART_OPTIONS[0],
        출근상태: '출근 가능',
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet['!cols'] = [
      { wch: 14 },
      { wch: 14 },
      { wch: 10 },
      { wch: 20 },
      { wch: 12 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '출근 확정 명단');

    XLSX.writeFile(workbook, `출근_응답명단_${date.replace(/-/g, '')}.xlsx`);
  };

  const handleDownloadSelectedConfirmed = (date = selectedAvailabilityDate, memberKeys = confirmedList) => {
    const selectedKeys = memberKeys.filter(
      (idKey) => selectedConfirmedMembers[getConfirmedSelectionKey(date, idKey)]
    );
    if (selectedKeys.length === 0) {
      alert('엑셀로 다운로드할 출근 확정 인원을 선택해 주세요.');
      return;
    }
    downloadConfirmedMembers(date, selectedKeys);
  };

  const handleDownloadConfirmedRoster = () => {
    downloadConfirmedMembers(selectedAvailabilityDate, confirmedList);
  };

  const handleDeleteSelected = async () => {
    const keysToDelete = Object.keys(selectedMembers).filter(idKey => selectedMembers[idKey]);
    if (keysToDelete.length === 0) return;

    if (confirm(`선택한 ${keysToDelete.length}명의 지원자를 목록에서 삭제하시겠습니까?`) && supabase) {
      for (const idKey of keysToDelete) {
        const item = memberDb[idKey];
        if (item) { await supabase.from('members').delete().match({ name: item.name, code: item.code }); }
      }
      setSelectedMembers({}); fetchMembers();
    }
  };

  const openChatWithWorker = (idKey: string) => { setChatTargetWorkerKey(idKey); setShowChatModal(true); markAsRead(idKey); };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeInput(newMemberName);
    const cleanCode = newMemberCode.trim();
    if (!cleanName || !cleanCode) return;
    if (!supabase) {
      alert('DB 연결에 실패하여 명단을 등록할 수 없습니다.');
      return;
    }

    const { error } = await supabase.from('members').insert([
      { name: cleanName, code: cleanCode, part: newMemberPart, is_joined: false, is_online: false },
    ]);
    if (error) {
      alert(`명단 등록에 실패했습니다: ${error.message}`);
      return;
    }
    alert(`${cleanName}님(코드: ${cleanCode})이 등록되었습니다.`);
    setNewMemberName(''); setNewMemberCode(''); setShowAddMemberModal(false); fetchMembers();
  };

  const handleDeleteMember = async (idKeyToDelete: string) => {
    const target = memberDb[idKeyToDelete];
    if (!target || !supabase) return;
    if (confirm(`'${target.name}' 지원자를 삭제하시겠습니까?`)) {
      await supabase.from('members').delete().match({ name: target.name, code: target.code });
      fetchMembers();
    }
  };

  const saveSelectedScheduledWorkDate = async (
    selectedKeys: string[],
    scheduledWorkDate: string | null
  ) => {
    if (isSavingScheduledWorkDate) return;
    if (!supabase) {
      alert('DB 연결에 실패하여 출근 예정일을 저장할 수 없습니다.');
      return;
    }

    const targetKeys = selectedKeys.filter((idKey) => memberDb[idKey]);
    if (targetKeys.length === 0) {
      alert('출근 예정일을 지정할 인원을 확인해 주세요.');
      return;
    }
    if (scheduledWorkDate && !/^\d{4}-\d{2}-\d{2}$/.test(scheduledWorkDate)) {
      alert('올바른 출근 예정일을 선택해 주세요.');
      return;
    }

    const failures: string[] = [];
    let updatedCount = 0;
    setIsSavingScheduledWorkDate(true);
    try {
      for (const idKey of targetKeys) {
        const member = memberDb[idKey];
        if (!member) continue;
        const { data, error } = await supabase
          .from('members')
          .update({ scheduled_work_date: scheduledWorkDate })
          .match({ name: member.name, code: member.code })
          .select('name, code');

        if (error) failures.push(`${member.name}: ${error.message}`);
        else if (data?.length === 1) updatedCount++;
        else failures.push(`${member.name}: 변경된 행을 확인하지 못했습니다. 권한 또는 명단을 확인해 주세요.`);
      }

      if (updatedCount > 0) await fetchMembers();
      if (failures.length > 0) {
        alert(
          `${updatedCount}명 저장, ${failures.length}명 실패했습니다.\n${failures.slice(0, 3).join('\n')}${failures.length > 3 ? '\n외 추가 오류가 있습니다.' : ''}\nSupabase에 scheduled_work_date 컬럼이 없으면 README의 DB 설정 절차를 먼저 완료해 주세요.`
        );
        return;
      }

      alert(scheduledWorkDate
        ? `${updatedCount}명의 출근 예정일을 ${formatDateLabel(scheduledWorkDate)}로 저장했습니다.`
        : `${updatedCount}명의 출근 예정일을 해제했습니다.`);
    } finally {
      setIsSavingScheduledWorkDate(false);
    }
  };

  const handleResponse = async (status: 'possible' | 'impossible') => {
    if (!supabase || isSavingAvailability) return;
    setIsSavingAvailability(true);
    try {
      const isClearingResponse = workerResponses[userUniqueKey] === status;
      const todayDate = getAvailabilityDateKey();
      const previousPossibleRecord = status === 'impossible'
        ? availabilityRecords
          .filter((record) => record.worker_name === userUniqueKey && record.status === 'possible')
          .sort((recordA, recordB) => recordB.created_at.localeCompare(recordA.created_at))[0]
        : undefined;
      let previousPossibleDate: string | null = null;
      let error;

      if (status === 'impossible' && previousPossibleRecord) {
        previousPossibleDate = getAvailabilityDateKey(new Date(previousPossibleRecord.created_at));
        const previousDateStart = new Date(`${previousPossibleDate}T00:00:00+09:00`);
        const previousDateEnd = new Date(previousDateStart);
        previousDateEnd.setUTCDate(previousDateEnd.getUTCDate() + 1);
        ({ error } = await supabase
          .from('work_availabilities')
          .update({ status: 'impossible' })
          .eq('worker_name', userUniqueKey)
          .eq('status', 'possible')
          .gte('created_at', previousDateStart.toISOString())
          .lt('created_at', previousDateEnd.toISOString()));

        if (error) {
          alert(`기존 출근 응답 변경에 실패했습니다: ${error.message}`);
          return;
        }

        if (previousPossibleDate !== todayDate) {
          const todayDateStart = new Date(`${todayDate}T00:00:00+09:00`);
          const todayDateEnd = new Date(todayDateStart);
          todayDateEnd.setUTCDate(todayDateEnd.getUTCDate() + 1);
          const { error: duplicateCleanupError } = await supabase
            .from('work_availabilities')
            .delete()
            .eq('worker_name', userUniqueKey)
            .eq('status', 'impossible')
            .gte('created_at', todayDateStart.toISOString())
            .lt('created_at', todayDateEnd.toISOString());

          if (duplicateCleanupError) {
            alert(`기존 날짜 응답은 출근 어려움으로 변경했지만 오늘 날짜의 중복 응답을 정리하지 못했습니다: ${duplicateCleanupError.message}`);
            await fetchCounts();
            return;
          }
        }
      } else if (isClearingResponse) {
        const responseDateStart = new Date(`${todayDate}T00:00:00+09:00`);
        const responseDateEnd = new Date(responseDateStart);
        responseDateEnd.setUTCDate(responseDateEnd.getUTCDate() + 1);
        ({ error } = await supabase
          .from('work_availabilities')
          .delete()
          .eq('worker_name', userUniqueKey)
          .gte('created_at', responseDateStart.toISOString())
          .lt('created_at', responseDateEnd.toISOString()));
      } else if (status === 'possible') {
        ({ error } = await supabase.from('work_availabilities').insert([{ worker_name: userUniqueKey, status }]));
        if (!error) {
          const { error: cleanupError } = await supabase
            .from('work_availabilities')
            .delete()
            .eq('worker_name', userUniqueKey)
            .eq('status', 'impossible');

          if (cleanupError) {
            alert(`출근 가능 응답은 저장했지만 이전 날짜의 어려움 응답을 삭제하지 못했습니다: ${cleanupError.message}`);
            await fetchCounts();
            return;
          }
        }
      } else {
        ({ error } = await supabase.from('work_availabilities').insert([{ worker_name: userUniqueKey, status }]));
      }

      if (error) {
        alert(`출근 응답 저장에 실패했습니다: ${error.message}`);
        return;
      }
      alert(isClearingResponse
        ? '출근 응답을 미제출로 변경했습니다.'
        : status === 'possible'
          ? '출근 가능으로 제출되었습니다. 이전 날짜의 출근 어려움 응답은 삭제했습니다.'
          : previousPossibleDate
            ? `${formatDateLabel(previousPossibleDate)} 응답을 출근 어려움으로 변경했습니다.`
            : '어려움으로 제출되었습니다.');
      await fetchCounts();
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      alert(`출근 응답 저장에 실패했습니다: ${message}`);
    } finally {
      setIsSavingAvailability(false);
    }
  };

  const closeGuideModal = () => {
    setActiveModal(null);
    if (role === 'worker' && userUniqueKey && isFirstLoginGuide) {
      localStorage.setItem(`first_guide_confirmed_${userUniqueKey}`, 'true');
      setIsFirstLoginGuide(false);
    }
  };

  const hideGuideForToday = () => {
    if (role === 'worker' && userUniqueKey) {
      localStorage.setItem(`first_guide_hidden_date_${userUniqueKey}`, getLocalDateKey());
      if (isFirstLoginGuide) {
        localStorage.setItem(`first_guide_confirmed_${userUniqueKey}`, 'true');
      }
    }
    setIsFirstLoginGuide(false);
    setActiveModal(null);
  };

  const neverShowGuideAgain = () => {
    if (role === 'worker' && userUniqueKey) {
      localStorage.setItem(`first_guide_never_show_${userUniqueKey}`, 'true');
      if (isFirstLoginGuide) {
        localStorage.setItem(`first_guide_confirmed_${userUniqueKey}`, 'true');
      }
    }
    setIsFirstLoginGuide(false);
    setActiveModal(null);
  };
  
  const openLoginHistory = (idKey: string) => { 
    setHistoryTargetKey(idKey); 
    setShowLoginHistoryModal(true); 
  };

  const totalAdminUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  const workerUnreadCount = unreadCounts['admin'] || 0;
  const lastMessage = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1].message : '🤖 안녕하세요! (주)올품 출근 안내 챗봇입니다. 셔틀버스, 첫 출근 서류, 근무시간, 주소 등을 물어보세요.';

  const allKeys = Object.keys(memberDb);

  const filteredKeys = allKeys.filter(idKey => {
    const item = memberDb[idKey];
    if (!item) return false;
    const term = memberSearchTerm.trim().toLowerCase();
    if (!term) return true;
    return item.name.toLowerCase().includes(term) || item.code.includes(term) || item.part.toLowerCase().includes(term);
  });

  const sortedKeys = [...filteredKeys].sort((aKey, bKey) => {
    const itemA = memberDb[aKey];
    const itemB = memberDb[bKey];

    if (!!itemA?.isJoined !== !!itemB?.isJoined) {
      return itemA?.isJoined ? 1 : -1;
    }

    const latestMessageA = latestWorkerMessageAt[aKey];
    const latestMessageB = latestWorkerMessageAt[bKey];
    if (latestMessageA !== latestMessageB) {
      if (!latestMessageA) return 1;
      if (!latestMessageB) return -1;
      return latestMessageB.localeCompare(latestMessageA);
    }

    const getRank = (item?: MemberItem) => {
      if (!item) return 99;
      if (workerResponses[item.idKey] === 'possible') return 1;
      if (item.isOnline) return 2;
      if (item.lastLoginAt) return 3;
      return 4;
    };

    const rankA = getRank(itemA);
    const rankB = getRank(itemB);

    if (rankA !== rankB) return rankA - rankB;
    return (itemA?.name || '').localeCompare(itemB?.name || '');
  });
  const activeMemberCount = allKeys.filter(
    (idKey) => !memberDb[idKey]?.withdrawnAt && !memberDb[idKey]?.resignedAt && !memberDb[idKey]?.isJoined && !memberDb[idKey]?.isNoShow
  ).length;
  const joinedMemberCount = allKeys.filter((idKey) => !memberDb[idKey]?.withdrawnAt && memberDb[idKey]?.isJoined).length;
  const resignedMemberCount = allKeys.filter((idKey) => !memberDb[idKey]?.withdrawnAt && !!memberDb[idKey]?.resignedAt).length;
  const noShowMemberCount = allKeys.filter((idKey) => !memberDb[idKey]?.withdrawnAt && memberDb[idKey]?.isNoShow).length;
  const withdrawnMemberCount = allKeys.filter((idKey) => !!memberDb[idKey]?.withdrawnAt).length;
  const getMemberCategory = (member?: MemberItem) =>
    member?.withdrawnAt ? 'withdrawn' : member?.resignedAt ? 'resigned' : member?.isJoined ? 'joined' : member?.isNoShow ? 'noShow' : 'applicants';
  const currentTabMemberKeys = allKeys.filter((idKey) => getMemberCategory(memberDb[idKey]) === adminMemberTab);
  const memberConnectionCounts = {
    all: currentTabMemberKeys.length,
    recorded: currentTabMemberKeys.filter((idKey) => !memberDb[idKey]?.isOnline && !!memberDb[idKey]?.lastLoginAt).length,
    online: currentTabMemberKeys.filter((idKey) => memberDb[idKey]?.isOnline === true).length,
    offline: currentTabMemberKeys.filter((idKey) => !memberDb[idKey]?.isOnline && !memberDb[idKey]?.lastLoginAt).length,
  };
  const currentTabSelectedCount = currentTabMemberKeys.filter((idKey) => selectedMembers[idKey]).length;
  const visibleMemberKeys = sortedKeys.filter((idKey) =>
    getMemberCategory(memberDb[idKey]) === adminMemberTab
  ).filter((idKey) => {
    const member = memberDb[idKey];
    if (!member) return false;
    if (memberConnectionFilter === 'online') return member.isOnline === true;
    if (memberConnectionFilter === 'recorded') return member.isOnline !== true && !!member.lastLoginAt;
    if (memberConnectionFilter === 'offline') return member.isOnline !== true && !member.lastLoginAt;
    return true;
  });

  const isAllChecked = currentTabMemberKeys.length > 0 && currentTabSelectedCount === currentTabMemberKeys.length;
  const selectedCount = Object.values(selectedMembers).filter(Boolean).length;

  const confirmedList = allKeys.filter(idKey => workerResponses[idKey] === 'possible');
  const confirmedCount = confirmedList.length;
  const selectedConfirmedCount = confirmedList.filter(
    (idKey) => selectedConfirmedMembers[getConfirmedSelectionKey(selectedAvailabilityDate, idKey)]
  ).length;
  const isAllConfirmedSelected = confirmedList.length > 0 && selectedConfirmedCount === confirmedList.length;
  const targetTotal = allKeys.length;
  const pendingCount = allKeys.filter(idKey => !workerResponses[idKey] || workerResponses[idKey] === 'none').length;

  const workDateString = getNextWorkDateInfo();
  const activeViewMode = role === 'admin' ? adminViewTab : 'worker';

  return (
    <div className={`fixed inset-0 z-0 flex h-[100dvh] flex-col overflow-hidden bg-slate-100 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] font-sans text-slate-800 sm:static sm:h-auto sm:min-h-screen sm:overflow-visible sm:px-4 sm:py-8 ${
      isAdminPcView ? 'lg:px-8 lg:py-6' : ''
    }`}>
      {isLoggedIn && role === 'admin' && (
        <div className={`mx-auto mb-2 sm:mb-4 flex items-center text-xs shrink-0 ${
          isAdminPcView ? 'w-full max-w-[1600px] justify-end' : 'max-w-md justify-end'
        }`}>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={() => {
                setIsAdminPcView(false);
                setAdminViewTab('worker');
              }}
              className={`px-3 py-1.5 rounded-full font-bold transition ${
                adminViewTab === 'worker' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              지원자 화면 보기
            </button>
            <button
              onClick={() => {
                setIsAdminPcView(false);
                setAdminViewTab('admin');
              }}
              className={`px-3 py-1.5 rounded-full font-bold transition relative ${
                adminViewTab === 'admin' && !isAdminPcView ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              관리자 화면 보기
              {totalAdminUnread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {totalAdminUnread}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setAdminViewTab('admin');
                setIsAdminPcView(true);
              }}
              aria-pressed={isAdminPcView}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition ${
                isAdminPcView ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              관리자 화면보기(PC)
            </button>
          </div>
        </div>
      )}

      <div className={`w-full mx-auto bg-slate-50 h-full min-h-0 flex-1 sm:flex-none sm:h-auto sm:min-h-[780px] overflow-y-auto overscroll-contain touch-pan-y relative p-4 ${
        isAdminPcView
          ? 'max-w-md sm:max-w-none sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-xl sm:p-6 lg:max-w-[1600px] lg:min-h-[calc(100vh-8rem)] lg:rounded-3xl lg:p-8'
          : 'max-w-md sm:rounded-[3rem] sm:border-[8px] sm:border-slate-900 sm:shadow-2xl sm:p-5'
      }`}>
        <div className={`hidden sm:block w-32 h-4 bg-slate-900 mx-auto rounded-b-xl mb-4 ${
          isAdminPcView ? 'sm:hidden' : ''
        }`}></div>

        {isLoggedIn && role === 'admin' && adminIncomingMessage && (
          <div className="absolute top-8 left-4 right-4 z-40 bg-white border border-blue-200 rounded-2xl shadow-xl p-3">
            <div className="flex items-start gap-2.5">
              <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4" />
              </span>
              <button
                onClick={() => {
                  openChatWithWorker(adminIncomingMessage.sender_name);
                  setAdminIncomingMessage(null);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block text-[11px] font-bold text-blue-700">
                  새 지원자 메시지 · {memberDb[adminIncomingMessage.sender_name]?.name || adminIncomingMessage.sender_name.split('_')[0]}
                </span>
                <span className="block text-xs text-slate-600 truncate mt-0.5">{adminIncomingMessage.message}</span>
                <span className="block text-[10px] font-bold text-blue-600 mt-1">눌러서 대화 확인하기</span>
              </button>
              <button
                onClick={() => setAdminIncomingMessage(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="알림 닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {isLoggedIn && role === 'worker' && workerIncomingNotification && (
          <div className={`absolute top-8 left-4 right-4 z-40 bg-white rounded-2xl shadow-xl p-3 border ${
            workerIncomingNotification.type === 'announcement' ? 'border-amber-200' : 'border-blue-200'
          }`}>
            <div className="flex items-start gap-2.5">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                workerIncomingNotification.type === 'announcement' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {workerIncomingNotification.type === 'announcement'
                  ? <Megaphone className="w-4 h-4" />
                  : <MessageSquare className="w-4 h-4" />}
              </span>
              <button
                onClick={() => {
                  if (workerIncomingNotification.type === 'announcement') {
                    openAnnouncementBell();
                  } else {
                    setShowChatModal(true);
                  }
                  setWorkerIncomingNotification(null);
                }}
                className="min-w-0 flex-1 text-left"
              >
                <span className={`block text-[11px] font-bold ${
                  workerIncomingNotification.type === 'announcement' ? 'text-amber-700' : 'text-blue-700'
                }`}>
                  {workerIncomingNotification.type === 'announcement'
                    ? `새 공지사항 · ${workerIncomingNotification.announcement.title}`
                    : '새 상담 메시지'}
                </span>
                <span className="block text-xs text-slate-600 truncate mt-0.5">
                  {workerIncomingNotification.type === 'announcement'
                    ? workerIncomingNotification.announcement.content
                    : workerIncomingNotification.message.message}
                </span>
                <span className={`block text-[10px] font-bold mt-1 ${
                  workerIncomingNotification.type === 'announcement' ? 'text-amber-600' : 'text-blue-600'
                }`}>눌러서 확인하기</span>
              </button>
              <button
                onClick={() => setWorkerIncomingNotification(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="알림 닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".xlsx, .xls, .csv, .txt, .tsv"
          className="hidden"
        />

        {!isLoggedIn && (
          <div className="py-4 flex flex-col justify-between min-h-[680px]">
            <div>
              <div className="text-center mt-4 mb-6">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <img src="/shiftmate-icon.svg" alt="올품 로고" className="h-8 w-8 rounded-full object-cover shadow-sm" />
                  <span className="text-xs font-black tracking-widest text-blue-600 uppercase">올품 채용 도우미</span>
                </div>
                <h1 className="text-2xl font-black text-slate-900 mt-1">올품(아르바이트) 채용 도우미</h1>
                <p className="text-xs text-slate-400 mt-1.5">성명과 전용 코드/비밀번호를 입력하세요</p>
              </div>

              {failedAttempts > 0 && (
                <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>인증 실패: {failedAttempts}/5회</span>
                </div>
              )}

              <div className="space-y-3.5 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">성명</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="성함 입력 (예: 박경현 또는 관리자)"
                      value={loginName}
                      disabled={isLockedOut}
                      onChange={(e) => setLoginName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">전용 코드 / 비밀번호</label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      placeholder="전용 코드 또는 비밀번호 입력"
                      value={loginCode}
                      disabled={isLockedOut}
                      onChange={(e) => setLoginCode(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => handleLogin('worker')}
                    disabled={isLockedOut}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-md shadow-blue-600/30"
                  >
                    지원자 접속하기
                  </button>
                  <button
                    onClick={() => handleLogin('admin')}
                    disabled={isLockedOut}
                    className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl text-sm transition"
                  >
                    관리자 접속하기
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <a
                    href={GOOGLE_FORM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <FileText className="w-4 h-4" /> 📝 신규 지원서 작성하기 (구글 폼)
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-slate-100/80 p-3.5 rounded-2xl border border-slate-200/80 text-center mt-2">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                ※ 신규 지원자는 위의 [지원서 작성하기]를 완료하신 후 부여받은 전용 코드로 접속하실 수 있습니다.
              </p>
            </div>
          </div>
        )}

        {isLoggedIn && activeViewMode === 'worker' && (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-black tracking-wider text-blue-600">올품(아르바이트) 채용 도우미</span>
                <h1 className="text-lg font-bold">{userName}님, 안녕하세요</h1>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowNotificationMenu((isOpen) => !isOpen)}
                    className="relative bg-white p-2.5 rounded-full border border-slate-200 shadow-sm hover:border-blue-300 transition"
                    title="새 상담 메시지와 공지 알림"
                    aria-label="새 상담 메시지와 공지 알림"
                    aria-expanded={showNotificationMenu}
                  >
                    <Bell className={`w-4 h-4 text-slate-600 ${workerUnreadCount > 0 || hasUnreadAnnounce ? 'animate-pulse' : ''}`} />
                    {workerUnreadCount > 0 && (
                      <span className="absolute -top-1 -left-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {workerUnreadCount > 9 ? '9+' : workerUnreadCount}
                      </span>
                    )}
                    {hasUnreadAnnounce && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 border-2 border-white rounded-full"></span>
                    )}
                  </button>
                  {showNotificationMenu && (
                    <div className="absolute right-0 top-12 z-30 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 space-y-1">
                      <p className="px-2 py-1 text-[10px] font-bold text-slate-400">새 알림</p>
                      <button
                        onClick={() => { setShowNotificationMenu(false); setShowChatModal(true); }}
                        className="w-full flex items-center justify-between gap-2 text-left p-2.5 rounded-xl hover:bg-blue-50 transition"
                      >
                        <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
                          <MessageSquare className="w-4 h-4 text-blue-600" /> 새 상담 메시지
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${workerUnreadCount > 0 ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {workerUnreadCount}
                        </span>
                      </button>
                      <button
                        onClick={openAnnouncementBell}
                        className="w-full flex items-center justify-between gap-2 text-left p-2.5 rounded-xl hover:bg-amber-50 transition"
                      >
                        <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
                          <Megaphone className="w-4 h-4 text-amber-500" /> 새 공지사항
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${hasUnreadAnnounce ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {hasUnreadAnnounce ? '새 공지' : '없음'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleLogout}
                  className="bg-white p-2.5 rounded-full border border-slate-200 shadow-sm hover:border-red-300 transition text-slate-600 hover:text-red-500"
                  title="로그아웃"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl">
              <p className="text-xs text-slate-400 font-medium mb-1">{workDateString} · 주간조/야간조</p>
              <h2 className="text-xl font-bold mb-1">다음 근무일 출근 가능하신가요?</h2>
              <p className="text-xs text-slate-400 mb-5">오후 6시까지 출근 여부를 제출해 주세요. 선택한 응답을 다시 누르면 미제출로 바뀝니다.</p>

              <div className="flex gap-2.5 mb-4">
                <button
                  onClick={() => handleResponse('possible')}
                  disabled={isSavingAvailability}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${
                    workerResponses[userUniqueKey] === 'possible' ? 'bg-blue-500 text-white ring-2 ring-blue-300' : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  출근 가능
                </button>
                <button
                  onClick={() => handleResponse('impossible')}
                  disabled={isSavingAvailability}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${
                    workerResponses[userUniqueKey] === 'impossible' ? 'bg-slate-600 text-white ring-2 ring-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  어려워요
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                현재 응답 · {workerResponses[userUniqueKey] === 'possible' ? '출근 가능' : workerResponses[userUniqueKey] === 'impossible' ? '어려워요' : '미제출'}
              </p>
            </div>

            <div
              onClick={() => setShowChatModal(true)}
              className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:border-blue-300 transition cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">1:1 상담 및 AI 챗봇</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-0.5">
                    <Bot className="w-3 h-3" /> 올품 AI
                  </span>
                  {workerUnreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                      +{workerUnreadCount}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-500 truncate max-w-[260px] font-medium">
                  {lastMessage}
                </p>
                <span className="text-[10px] text-blue-600 font-bold shrink-0">대화하기 →</span>
              </div>
            </div>

            {announcements.length > 0 && (
              <button
                onClick={openAnnouncementBell}
                className="w-full text-left bg-amber-50 border border-amber-200 rounded-2xl px-3.5 py-3 shadow-sm hover:bg-amber-100 transition"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Megaphone className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-[11px] font-bold text-amber-800">공지사항</span>
                  <span className="text-[10px] text-amber-700 truncate">{announcements[0].title}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-amber-600 ml-auto shrink-0" />
                </div>
                <p className="text-xs text-slate-700 leading-relaxed line-clamp-2 pl-6">
                  {announcements[0].content}
                </p>
              </button>
            )}

            <div>
              <h3 className="text-xs font-bold text-slate-500 mb-2">빠른 메뉴</h3>
              <div className="grid grid-cols-4 gap-2">
                <button 
                  onClick={() => setActiveModal('shuttle')}
                  className="bg-white p-2.5 rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center gap-1.5 shadow-sm hover:border-blue-300 transition text-center"
                >
                  <Bus className="w-5 h-5 text-blue-500 shrink-0" />
                  <span className="text-[10px] font-bold text-slate-700">셔틀 노선표</span>
                </button>
                <button 
                  onClick={() => {
                    setIsFirstLoginGuide(false);
                    setActiveModal('guide');
                  }}
                  className="bg-white p-2.5 rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center gap-1.5 shadow-sm hover:border-blue-300 transition text-center"
                >
                  <BookOpen className="w-5 h-5 text-blue-500 shrink-0" />
                  <span className="text-[10px] font-bold text-slate-700">첫출근 가이드</span>
                </button>
                <button 
                  onClick={() => setShowAppSelectModal(true)}
                  className="bg-white p-2.5 rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center gap-1.5 shadow-sm hover:border-emerald-300 transition text-center"
                >
                  <Download className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span className="text-[10px] font-bold text-slate-700">ONE-HR</span>
                </button>
                <button
                  onClick={() => setActiveModal('resignation')}
                  className="bg-white p-2.5 rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center gap-1.5 shadow-sm hover:border-amber-300 transition text-center"
                >
                  <FileText className="w-5 h-5 text-amber-500 shrink-0" />
                  <span className="text-[10px] font-bold text-slate-700">퇴직 절차</span>
                </button>
                <button
                  onClick={handleWorkerSelfDelete}
                  className="bg-white p-2.5 rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center gap-1.5 shadow-sm hover:border-red-300 transition text-center"
                >
                  <UserMinus className="w-5 h-5 text-red-500 shrink-0" />
                  <span className="text-[10px] font-bold text-red-500">회원 탈퇴</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoggedIn && activeViewMode === 'admin' && (
          <div className={isAdminPcView ? 'grid grid-cols-1 gap-5 lg:grid-cols-12' : 'space-y-5'}>
            <div className={`flex justify-between items-center ${
              isAdminPcView ? 'lg:col-span-12 rounded-2xl bg-white px-5 py-4 shadow-sm border border-slate-200/80' : ''
            }`}>
              <div>
                <span className="text-xs font-black tracking-wider text-blue-600">올품(아르바이트) 채용 도우미 관리자</span>
                <h1 className={isAdminPcView ? 'text-xl font-bold' : 'text-lg font-bold'}>{userName}님, 안녕하세요</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAdminManageModal(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-full border border-slate-700 shadow-sm transition"
                  title="관리자 계정 설정"
                >
                  <UserCog className="w-4 h-4 text-emerald-400" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowAdminNotificationMenu((isOpen) => !isOpen)}
                    className="relative bg-white p-2 rounded-full border border-slate-200 shadow-sm"
                    title="지원자 메시지 알림"
                    aria-label="지원자 메시지 알림"
                    aria-expanded={showAdminNotificationMenu}
                  >
                    <Bell className={`w-4 h-4 text-slate-600 ${totalAdminUnread > 0 ? 'animate-pulse' : ''}`} />
                    {totalAdminUnread > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {totalAdminUnread > 9 ? '9+' : totalAdminUnread}
                      </span>
                    )}
                  </button>
                  {showAdminNotificationMenu && (
                    <div className="absolute right-0 top-11 z-30 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 space-y-1">
                      <p className="px-2 py-1 text-[10px] font-bold text-slate-400">새 알림</p>
                      <div className="max-h-48 overflow-y-auto">
                        {Object.entries(unreadWorkerMessages)
                          .sort(([, messageA], [, messageB]) =>
                            (messageB.created_at || '').localeCompare(messageA.created_at || '')
                          )
                          .map(([workerKey, message]) => (
                            <button
                              key={workerKey}
                              onClick={() => {
                                setShowAdminNotificationMenu(false);
                                openChatWithWorker(workerKey);
                              }}
                              className="w-full text-left p-2.5 rounded-xl hover:bg-blue-50 transition"
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-700 truncate">
                                  {memberDb[workerKey]?.name || workerKey.split('_')[0]}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white shrink-0">
                                  {unreadCounts[workerKey] || 0}
                                </span>
                              </span>
                              <span className="block text-[10px] text-slate-500 truncate mt-0.5">{message.message}</span>
                            </button>
                          ))}
                        {totalAdminUnread === 0 && (
                          <p className="px-2 py-3 text-xs text-slate-400 text-center">새 지원자 메시지가 없습니다.</p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setShowAdminNotificationMenu(false);
                          openAnnouncementBell();
                        }}
                        className="w-full flex items-center gap-2 text-left p-2.5 rounded-xl hover:bg-amber-50 transition text-xs font-bold text-slate-700"
                      >
                        <Megaphone className="w-4 h-4 text-amber-500" /> 공지사항 보기
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-white p-2 rounded-full border border-slate-200 shadow-sm text-slate-600 hover:text-red-500"
                  title="로그아웃"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              className={`bg-slate-900 text-white p-5 rounded-2xl shadow-xl ${
                isAdminPcView ? 'lg:col-span-5 lg:row-start-3' : ''
              }`}
              onTouchStart={handleAvailabilitySwipeStart}
              onTouchEnd={handleAvailabilitySwipeEnd}
            >
              <p className="text-xs text-slate-400 font-medium mb-1">다음 근무 · {workDateString}</p>
              <div className="flex items-center justify-between gap-2 mb-3">
                <label htmlFor="availability-response-date" className="text-xs font-bold text-slate-300 shrink-0">
                  응답 누른 날짜
                </label>
                <div className="flex min-w-0 flex-col items-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowScheduledRosterModal(true)}
                    className="w-full rounded-lg border border-emerald-400/70 bg-emerald-500/15 px-2 py-1.5 text-[10px] font-bold text-emerald-200 transition hover:bg-emerald-500/30"
                  >
                    출근 예정 명단 확인 ({scheduledRosterCount}명)
                  </button>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <select
                      id="availability-response-date"
                      value={selectedAvailabilityDate}
                      onChange={(event) => {
                        setSelectedAvailabilityDate(event.target.value);
                        setSelectedConfirmedMembers({});
                      }}
                      className="min-w-0 bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400"
                    >
                      <option value="all">전체 보기</option>
                      {availabilityDates.map((date) => (
                        <option key={date} value={date}>{formatDateLabel(date)}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        setSelectedAvailabilityDate(getAvailabilityDateKey());
                        setSelectedConfirmedMembers({});
                      }}
                      className="shrink-0 rounded-lg border border-blue-400/70 bg-blue-600/20 px-2 py-1.5 text-[10px] font-bold text-blue-200 transition hover:bg-blue-600/40"
                    >
                      오늘 날짜
                    </button>
                  </div>
                </div>
              </div>
              {selectedAvailabilityDate === 'all' ? (
                <div className="space-y-3 pr-1">
                  <button
                    onClick={() => setShowAvailabilitySummary((showSummary) => !showSummary)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-blue-200 transition hover:bg-slate-700"
                  >
                    {showAvailabilitySummary ? '날짜별 명단 보기' : '이전 요약 화면 보기'}
                  </button>
                  {showAvailabilitySummary ? (
                    <div className="space-y-2">
                      {availabilityByDate.map(({ date, possible, impossible, scheduled }) => (
                        <div key={date} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <h2 className="text-sm font-black">{formatDateLabel(date)}</h2>
                            <button
                              onClick={() => {
                                setSelectedAvailabilityDate(date);
                                setSelectedConfirmedMembers({});
                              }}
                              className="text-[10px] font-bold text-blue-300 hover:text-white"
                            >
                              자세히 보기
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-300 mb-2">
                            출근 가능 {possible.length}명 · 출근 불가 {impossible.length}명 · 출근 예정 {scheduled.length}명 · 미응답 {Math.max(targetTotal - possible.length - impossible.length, 0)}명
                          </p>
                          {possible.length > 0 && (
                            <p className="text-[10px] leading-relaxed text-emerald-300">
                              가능: {possible.map((workerKey) => memberDb[workerKey]?.name || workerKey.split('_')[0]).join(', ')}
                            </p>
                          )}
                          {impossible.length > 0 && (
                            <p className="text-[10px] leading-relaxed text-rose-300 mt-1">
                              불가: {impossible.map((workerKey) => memberDb[workerKey]?.name || workerKey.split('_')[0]).join(', ')}
                            </p>
                          )}
                          {scheduled.length > 0 && (
                            <p className="text-[10px] leading-relaxed text-blue-300 mt-1">
                              출근 예정: {scheduled.map((workerKey) => memberDb[workerKey]?.name || workerKey.split('_')[0]).join(', ')}
                            </p>
                          )}
                          {possible.length === 0 && impossible.length === 0 && (
                            <p className="text-[10px] text-slate-400">
                              {scheduled.length > 0 ? '아직 응답한 인원은 없습니다.' : '아직 응답이 없습니다.'}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                  {availabilityByDate.map(({ date, responses, possible, impossible, scheduled }) => {
                    const dateSelectionCount = possible.filter(
                      (idKey) => selectedConfirmedMembers[getConfirmedSelectionKey(date, idKey)]
                    ).length;
                    const isDateAllSelected = possible.length > 0 && dateSelectionCount === possible.length;
                    const listedWorkerKeys = Array.from(new Set([...possible, ...impossible, ...scheduled]));

                    return (
                      <section key={date} className="bg-slate-900 border border-slate-700 rounded-2xl p-3.5">
                        <div className="flex items-center gap-2 border-b border-slate-700 pb-2.5">
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          <h2 className="min-w-0 flex-1 text-xs font-black text-white">
                            출근 응답 명단 · {formatDateLabel(date)} (가능 {possible.length}명 · 어려움 {impossible.length}명 · 예정 {scheduled.length}명)
                          </h2>
                        </div>

                        {possible.length > 0 && (
                          <div className="py-2.5 space-y-2">
                            <button
                              onClick={() => toggleSelectAllConfirmedForDate(date, possible)}
                              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300"
                            >
                              {isDateAllSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                              전체 선택 ({dateSelectionCount}/{possible.length})
                            </button>
                            {dateSelectionCount > 0 && (
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => {
                                    setGroupMessageRecipientKeys(
                                      possible.filter(
                                        (idKey) => selectedConfirmedMembers[getConfirmedSelectionKey(date, idKey)]
                                      )
                                    );
                                    setShowGroupMsgModal(true);
                                  }}
                                  className="justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold px-2 py-2 rounded-lg text-[10px] flex items-center gap-1 transition"
                                >
                                  <Send className="w-3.5 h-3.5" /> 메시지 ({dateSelectionCount})
                                </button>
                                <button
                                  onClick={() => handleDownloadSelectedConfirmed(date, possible)}
                                  className="justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-2 rounded-lg text-[10px] flex items-center gap-1 transition"
                                >
                                  <Download className="w-3.5 h-3.5" /> 엑셀 다운로드
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-2">
                          {listedWorkerKeys.length === 0 ? (
                            <p className="py-5 text-center text-[11px] text-slate-400">
                              해당 날짜에 응답하거나 출근 예정인 인원이 없습니다.
                            </p>
                          ) : (
                            listedWorkerKeys.map((idKey) => {
                                const member = memberDb[idKey];
                                const selectionKey = getConfirmedSelectionKey(date, idKey);
                                const isSelected = !!selectedConfirmedMembers[selectionKey];
                                const responseStatus = responses[idKey];
                                const isPossible = responseStatus === 'possible';
                                const isScheduled = scheduled.includes(idKey);

                                return (
                                  <div
                                    key={idKey}
                                    className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex justify-between items-center text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      {isPossible ? (
                                        <button
                                          onClick={() =>
                                            setSelectedConfirmedMembers((prev) => ({
                                              ...prev,
                                              [selectionKey]: !prev[selectionKey],
                                            }))
                                          }
                                          className="text-slate-400"
                                          aria-label={`${member?.name || idKey.split('_')[0]} 선택`}
                                        >
                                          {isSelected ? (
                                            <CheckSquare className="w-4 h-4 text-blue-600" />
                                          ) : (
                                            <Square className="w-4 h-4 text-slate-300" />
                                          )}
                                        </button>
                                      ) : (
                                        <span className="w-4" aria-hidden="true" />
                                      )}
                                      <div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-slate-800">
                                            {member?.name || idKey.split('_')[0]}
                                          </span>
                                          <span className="font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                            {member?.code || idKey.split('_')[1]}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                          {member?.part || WORK_PART_OPTIONS[0]}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      {responseStatus ? (
                                        <span className={`font-bold px-2 py-1 rounded-lg text-[10px] ${
                                          isPossible ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                        }`}>
                                          {isPossible ? '출근 가능' : '출근 어려움'}
                                        </span>
                                      ) : (
                                        <span className="font-bold px-2 py-1 rounded-lg text-[10px] bg-slate-200 text-slate-600">
                                          응답 전
                                        </span>
                                      )}
                                      {isScheduled && (
                                        <span className="font-bold px-2 py-1 rounded-lg text-[10px] bg-blue-100 text-blue-700">
                                          출근 예정
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                          )}
                        </div>
                      </section>
                    );
                  })}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-black mb-1">출근 가능 {confirmedCount}명</h2>
                  <p className="text-xs text-slate-400 mb-4">선택한 응답 날짜 기준 · 전체 명단 {targetTotal}명 · 미응답 {pendingCount}명</p>

                  <div className="w-full bg-slate-800 h-2 rounded-full mb-5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${targetTotal > 0 ? Math.min((confirmedCount / targetTotal) * 100, 100) : 0}%` }}
                    ></div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowConfirmedModal(true)}
                      className="flex flex-col items-center justify-center gap-0.5 bg-blue-600 hover:bg-blue-500 py-2.5 rounded-xl font-bold text-xs leading-tight text-white transition shadow-lg shadow-blue-900/50"
                    >
                      <span>출근 명단 확인</span>
                      <span className="text-[10px]">
                        {new Date(`${selectedAvailabilityDate}T00:00:00`).toLocaleDateString('ko-KR', {
                          month: 'numeric',
                          day: 'numeric',
                          weekday: 'short',
                        })} · {confirmedCount}명
                      </span>
                    </button>
                    <button
                      onClick={handleDownloadConfirmedRoster}
                      disabled={confirmedCount === 0}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      엑셀 다운로드
                    </button>
                  </div>
                  {Object.entries(memberDb).some(([, member]) => member.scheduledWorkDate === selectedAvailabilityDate) && (
                    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                      <p className="text-xs font-bold text-blue-800 mb-1">
                        출근 예정 · {Object.entries(memberDb).filter(([, member]) => member.scheduledWorkDate === selectedAvailabilityDate).length}명
                      </p>
                      <p className="text-[11px] leading-relaxed text-blue-700">
                        {Object.entries(memberDb)
                          .filter(([, member]) => member.scheduledWorkDate === selectedAvailabilityDate)
                          .map(([, member]) => `${member.name} (${member.code})`)
                          .join(', ')}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className={`bg-amber-50 border border-amber-200/80 p-3.5 rounded-2xl flex items-center justify-between gap-2 ${
              isAdminPcView ? 'lg:col-span-12' : ''
            }`}>
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900">전체 공지 알림 발송</h4>
                  <p className="text-[10px] text-amber-700">종 모양(🔔) 알림 창으로 공지 전송</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setShowAnnouncePopup(true)}
                  className="bg-white hover:bg-amber-100 border border-amber-200 text-amber-800 text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition"
                >
                  공지 목록
                </button>
                <button
                  onClick={() => setShowBroadcastModal(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition shadow-sm"
                >
                  공지 작성
                </button>
              </div>
            </div>

            <div className={`bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3 ${
              isAdminPcView ? 'lg:col-span-7 lg:row-start-3' : ''
            }`}>
              <div className="flex justify-between items-center border-b pb-2.5">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-800">지원자 코드 및 명단</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold px-2 py-1.5 rounded-lg flex items-center gap-1 transition"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> 파일 등록
                  </button>
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold px-2 py-1.5 rounded-lg flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> 직접 등록
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => setAdminMemberTab('applicants')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                    adminMemberTab === 'applicants'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>지원자 ({activeMemberCount})</span>
                </button>
                <button
                  onClick={() => setAdminMemberTab('joined')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                    adminMemberTab === 'joined'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>입사 ({joinedMemberCount})</span>
                </button>
                <button
                  onClick={() => setAdminMemberTab('resigned')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                    adminMemberTab === 'resigned'
                      ? 'bg-white text-orange-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <UserMinus className="w-3.5 h-3.5 shrink-0" />
                  <span>퇴사 ({resignedMemberCount})</span>
                </button>
                <button
                  onClick={() => setAdminMemberTab('noShow')}
                  className={`flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-bold transition ${
                    adminMemberTab === 'noShow'
                      ? 'bg-white text-rose-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>노쇼 ({noShowMemberCount})</span>
                </button>
                <button
                  onClick={() => setAdminMemberTab('withdrawn')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                    adminMemberTab === 'withdrawn'
                      ? 'bg-white text-slate-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <UserMinus className="w-3.5 h-3.5 shrink-0" />
                  <span>탈퇴 ({withdrawnMemberCount})</span>
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="성명, 코드(전화번호 뒷자리) 검색..."
                  value={memberSearchTerm}
                  onChange={(e) => setMemberSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                />
                {memberSearchTerm && (
                  <button 
                    onClick={() => setMemberSearchTerm('')} 
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-1.5" aria-label="접속 상태별 명단 필터">
                {([
                  ['all', '전체', memberConnectionCounts.all],
                  ['recorded', '기록', memberConnectionCounts.recorded],
                  ['online', '접속중', memberConnectionCounts.online],
                  ['offline', '미접속', memberConnectionCounts.offline],
                ] as const).map(([filter, label, count]) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setMemberConnectionFilter(filter)}
                    aria-pressed={memberConnectionFilter === filter}
                    className={`rounded-lg border px-1 py-2 text-[10px] font-bold transition ${
                      memberConnectionFilter === filter
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {label} {count}
                  </button>
                ))}
              </div>

              <div className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 font-bold text-slate-700 hover:text-blue-600 transition"
                >
                  {isAllChecked ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>
                    {adminMemberTab === 'joined'
                      ? '입사 완료'
                      : adminMemberTab === 'resigned'
                      ? '퇴사'
                      : adminMemberTab === 'noShow'
                      ? '노쇼'
                      : adminMemberTab === 'withdrawn'
                      ? '탈퇴'
                      : '지원자'}
                    {' '}전체 선택 ({currentTabSelectedCount}/{currentTabMemberKeys.length})
                  </span>
                </button>

                <div className="flex items-center gap-1.5">
                  {selectedCount > 0 && (
                    <button
                      onClick={handleDownloadSelected}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 transition shadow-sm"
                    >
                      <Download className="w-3 h-3" /> 엑셀 ({selectedCount})
                    </button>
                  )}
                  {selectedCount > 0 && (
                    <button
                      onClick={() => {
                        setGroupMessageRecipientKeys(
                          Object.keys(selectedMembers).filter((idKey) => selectedMembers[idKey] && memberDb[idKey])
                        );
                        setShowGroupMsgModal(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 transition shadow-sm"
                    >
                      <Send className="w-3 h-3" /> 선택 메시지 ({selectedCount})
                    </button>
                  )}

                  {selectedCount > 0 && (
                    <button
                      onClick={handleDeleteSelected}
                      className="bg-red-500 hover:bg-red-600 text-white font-bold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1 transition shadow-sm"
                    >
                      <Trash2 className="w-3 h-3" /> 삭제
                    </button>
                  )}
                </div>
              </div>

              <div className={`divide-y divide-slate-100 max-h-56 overflow-y-auto ${
                isAdminPcView ? 'lg:max-h-[calc(100vh-22rem)]' : ''
              }`}>
                {visibleMemberKeys.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs font-medium">
                    {memberSearchTerm
                      ? `'${memberSearchTerm}' 검색 결과가 없습니다.`
                      : memberConnectionFilter !== 'all'
                      ? '선택한 접속 상태의 인원이 없습니다.'
                      : adminMemberTab === 'joined'
                      ? '입사 완료 인원이 없습니다.'
                      : adminMemberTab === 'resigned'
                      ? '퇴사 처리된 인원이 없습니다.'
                      : adminMemberTab === 'noShow'
                      ? '노쇼로 표시된 인원이 없습니다.'
                      : adminMemberTab === 'withdrawn'
                      ? '탈퇴한 인원이 없습니다.'
                      : '등록된 지원자가 없습니다.'}
                  </div>
                ) : (
                  visibleMemberKeys.map((idKey, index) => {
                    const member = memberDb[idKey];
                    if (!member) return null;

                    const unreadCount = unreadCounts[idKey] || 0;
                    const workerStatus = workerResponses[idKey] || 'none';
                    const isChecked = !!selectedMembers[idKey];
                    const online = member.isOnline === true;
                    const memberCategory = getMemberCategory(member);

                    return (
                      <React.Fragment key={idKey}>
                      {(index === 0 || getMemberCategory(memberDb[visibleMemberKeys[index - 1]]) !== memberCategory) && (
                        <div className={`flex items-center justify-between px-2 py-2.5 ${
                          index === 0 ? '' : 'border-t-2 border-slate-200'
                        } ${
                          memberCategory === 'joined'
                            ? 'bg-emerald-50/70'
                            : memberCategory === 'resigned'
                            ? 'bg-orange-50/70'
                            : memberCategory === 'noShow'
                            ? 'bg-rose-50/70'
                            : memberCategory === 'withdrawn'
                            ? 'bg-slate-200/70'
                            : 'bg-slate-50/80'
                        }`}>
                          <div>
                            <div className={`flex items-center gap-1.5 text-[11px] font-bold ${
                              memberCategory === 'joined'
                                ? 'text-emerald-800'
                                : memberCategory === 'resigned'
                                ? 'text-orange-800'
                                : memberCategory === 'noShow'
                                ? 'text-rose-800'
                                : memberCategory === 'withdrawn'
                                ? 'text-slate-700'
                                : 'text-slate-600'
                            }`}>
                              {memberCategory === 'joined'
                                ? <UserCheck className="w-3.5 h-3.5" />
                                : memberCategory === 'resigned'
                                ? <UserMinus className="w-3.5 h-3.5" />
                                : memberCategory === 'noShow'
                                ? <AlertTriangle className="w-3.5 h-3.5" />
                                : memberCategory === 'withdrawn'
                                ? <UserMinus className="w-3.5 h-3.5" />
                                : <Users className="w-3.5 h-3.5" />}
                              {memberCategory === 'joined'
                                ? '입사 완료 인원'
                                : memberCategory === 'resigned'
                                ? '퇴사 인원'
                                : memberCategory === 'noShow'
                                ? '노쇼 인원'
                                : memberCategory === 'withdrawn'
                                ? '탈퇴 인원'
                                : '지원자'}
                            </div>
                            <span className={`text-[10px] font-bold ${
                              memberCategory === 'joined'
                                ? 'text-emerald-700'
                                : memberCategory === 'resigned'
                                ? 'text-orange-700'
                                : memberCategory === 'noShow'
                                ? 'text-rose-700'
                                : memberCategory === 'withdrawn'
                                ? 'text-slate-600'
                                : 'text-slate-500'
                            }`}>
                              {memberCategory === 'joined'
                                ? joinedMemberCount
                                : memberCategory === 'resigned'
                                ? resignedMemberCount
                                : memberCategory === 'noShow'
                                ? noShowMemberCount
                                : memberCategory === 'withdrawn'
                                ? withdrawnMemberCount
                                : activeMemberCount}명
                            </span>
                          </div>
                          {(() => {
                            const groupKeys = currentTabMemberKeys;
                            const selectedGroupCount = groupKeys.filter((key) => selectedMembers[key]).length;
                            const isGroupSelected = groupKeys.length > 0 && selectedGroupCount === groupKeys.length;
                            return (
                              <button
                                onClick={() => toggleSelectMembers(groupKeys)}
                                className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition ${
                                  memberCategory === 'joined'
                                    ? 'text-emerald-800 hover:bg-emerald-100'
                                    : memberCategory === 'resigned'
                                    ? 'text-orange-800 hover:bg-orange-100'
                                    : memberCategory === 'noShow'
                                    ? 'text-rose-800 hover:bg-rose-100'
                                    : memberCategory === 'withdrawn'
                                    ? 'text-slate-700 hover:bg-slate-300'
                                    : 'text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {isGroupSelected
                                  ? <CheckSquare className="w-3.5 h-3.5" />
                                  : <Square className="w-3.5 h-3.5" />}
                                전체 선택 ({selectedGroupCount}/{groupKeys.length})
                              </button>
                            );
                          })()}
                        </div>
                      )}
                      <div className={`py-2.5 flex justify-between items-center text-xs ${
                        memberCategory === 'joined'
                          ? 'bg-emerald-50/30'
                          : memberCategory === 'resigned'
                          ? 'bg-orange-50/30'
                          : memberCategory === 'noShow'
                          ? 'bg-rose-50/30'
                          : memberCategory === 'withdrawn'
                          ? 'bg-slate-100/70'
                          : ''
                      }`}>
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleSelectMember(idKey)} className="text-slate-400">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </button>

                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="relative flex h-2 w-2" title={online ? '현재 접속중' : '미접속'}>
                                {online && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${online ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                              </span>

                              <span className="font-bold text-slate-800">{member.name}</span>
                              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-blue-700 font-bold">
                                {member.code}
                              </span>

                              <button
                                onClick={() => openLoginHistory(idKey)}
                                className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 transition cursor-pointer ${
                                  online
                                    ? 'bg-emerald-100 text-emerald-700 font-bold hover:bg-emerald-200'
                                    : member.lastLoginAt
                                    ? 'bg-slate-100 text-slate-600 hover:bg-blue-100'
                                    : 'bg-amber-50 text-amber-600 font-medium hover:bg-amber-100'
                                }`}
                                title="접속 기록 보기"
                              >
                                <Clock className="w-3 h-3" />
                                {online ? '접속중' : member.lastLoginAt ? '기록' : '미접속'}
                              </button>

                              {workerStatus === 'possible' && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                                  출근 가능
                                </span>
                              )}

                              {member.isJoined && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white shadow-sm flex items-center gap-0.5">
                                  <UserCheck className="w-3 h-3" /> 입사완료
                                </span>
                              )}
                              {member.resignedAt && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-600 text-white shadow-sm flex items-center gap-0.5">
                                  <UserMinus className="w-3 h-3" /> 퇴사
                                </span>
                              )}
                              {member.isNoShow && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white shadow-sm flex items-center gap-0.5">
                                  <AlertTriangle className="w-3 h-3" /> 노쇼
                                </span>
                              )}
                              {member.withdrawnAt && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-600 text-white shadow-sm flex items-center gap-0.5">
                                  <UserMinus className="w-3 h-3" /> 탈퇴
                                </span>
                              )}
                              
                              {workerStatus === 'impossible' && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200/60">
                                  출근 불가
                                </span>
                              )}
                              {workerStatus === 'none' && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                                  미제출
                                </span>
                              )}
                            </div>
                            <select
                              aria-label={`${member.name} 근무 파트`}
                              title="선택하면 근무 파트가 저장됩니다"
                              value={WORK_PART_OPTIONS.some((part) => part === member.part) ? member.part : ''}
                              onChange={(event) => void handleMemberPartChange(idKey, event.target.value)}
                              disabled={savingMemberPartKey === idKey}
                              className="mt-1 max-w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 disabled:opacity-60"
                            >
                              {!WORK_PART_OPTIONS.some((part) => part === member.part) && (
                                <option value="" disabled>
                                  기존 파트: {member.part || '미지정'} · 변경 선택
                                </option>
                              )}
                              {WORK_PART_OPTIONS.map((part) => (
                                <option key={part} value={part}>{part}</option>
                              ))}
                            </select>
                            {member.scheduledWorkDate && (
                              <p className="mt-1 inline-flex rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                                출근 예정 · {formatDateLabel(member.scheduledWorkDate)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {member.withdrawnAt ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[9px] text-slate-500">
                                {new Date(member.withdrawnAt).toLocaleDateString('ko-KR')} 탈퇴
                              </span>
                              <button
                                onClick={() => restoreWithdrawnMember(idKey)}
                                className="font-bold px-1.5 py-1.5 rounded-xl text-[10px] transition bg-blue-50 text-blue-700 border border-blue-200"
                                title="탈퇴 상태 해제"
                              >
                                탈퇴 해제
                              </button>
                            </div>
                          ) : member.resignedAt ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[9px] text-orange-700">
                                {new Date(member.resignedAt).toLocaleDateString('ko-KR')} 퇴사
                              </span>
                              <button
                                onClick={() => toggleResignedStatus(idKey)}
                                className="font-bold px-1.5 py-1.5 rounded-xl text-[10px] transition bg-orange-50 text-orange-700 border border-orange-200"
                                title="퇴사 상태 취소"
                              >
                                퇴사 취소
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => toggleJoinStatus(idKey)}
                                className={`font-bold px-1.5 py-1.5 rounded-xl text-[10px] transition ${
                                  member.isJoined
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'
                                }`}
                                title="입사 상태 변경"
                              >
                                {member.isJoined ? '입사완료' : '입사'}
                              </button>

                              {member.isJoined && (
                                <button
                                  onClick={() => toggleResignedStatus(idKey)}
                                  className="font-bold px-1.5 py-1.5 rounded-xl text-[10px] transition bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
                                  title="퇴사 처리"
                                >
                                  퇴사
                                </button>
                              )}

                              <button
                                onClick={() => toggleNoShowStatus(idKey)}
                                className={`font-bold px-1.5 py-1.5 rounded-xl text-[10px] transition ${
                                  member.isNoShow
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600'
                                }`}
                                title="노쇼 상태 변경"
                              >
                                {member.isNoShow ? '노쇼 해제' : '노쇼'}
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => openChatWithWorker(idKey)}
                            className={`font-bold px-2 py-1.5 rounded-xl text-[11px] flex items-center gap-1 transition ${
                              unreadCount > 0 
                                ? 'bg-red-500 text-white shadow-md shadow-red-500/20 animate-pulse' 
                                : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                            }`}
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>대화</span>
                            {unreadCount > 0 && (
                              <span className="bg-white text-red-600 font-extrabold text-[10px] px-1.5 py-0.2 rounded-full">
                                +{unreadCount}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteMember(idKey)}
                            className="text-slate-300 hover:text-red-500 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      </React.Fragment>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {showScheduledRosterModal && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full rounded-3xl p-5 shadow-2xl space-y-4 max-h-[600px] flex flex-col border border-slate-200">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-emerald-600" /> 출근 예정 명단 ({scheduledRosterCount}명)
                </h3>
                <button
                  onClick={() => setShowScheduledRosterModal(false)}
                  className="text-slate-400 text-sm font-bold"
                  aria-label="출근 예정 명단 닫기"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3">
                {scheduledRosterCount > 0 && (
                  <div className="sticky top-0 z-10 space-y-2 rounded-xl border border-slate-200 bg-white p-2">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const selectAll = selectedScheduledRosterKeys.length < scheduledRosterMemberKeys.length;
                          setSelectedScheduledRosterMembers((previous) => {
                            const updated = { ...previous };
                            scheduledRosterMemberKeys.forEach((idKey) => {
                              if (selectAll) updated[idKey] = true;
                              else delete updated[idKey];
                            });
                            return updated;
                          });
                        }}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700"
                      >
                        {selectedScheduledRosterKeys.length === scheduledRosterMemberKeys.length ? (
                          <CheckSquare className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-400" />
                        )}
                        전체 선택 ({selectedScheduledRosterKeys.length}/{scheduledRosterCount})
                      </button>
                      <button
                        type="button"
                        disabled={selectedScheduledRosterKeys.length === 0}
                        onClick={() => {
                          setGroupMessageRecipientKeys(selectedScheduledRosterKeys);
                          setShowScheduledRosterModal(false);
                          setShowGroupMsgModal(true);
                        }}
                        className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Send className="h-3 w-3" />
                        선택 인원 메시지 ({selectedScheduledRosterKeys.length})
                      </button>
                    </div>
                  </div>
                )}
                {scheduledRosterDates.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs font-medium">
                    아직 출근 예정으로 지정된 인원이 없습니다.
                  </div>
                ) : (
                  scheduledRosterDates.map(({ date, scheduled }) => (
                    <section key={date} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h4 className="text-xs font-black text-slate-800">
                          {formatDateLabel(date)} · {scheduled.length}명
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAvailabilityDate(date);
                            setSelectedConfirmedMembers({});
                            setShowScheduledRosterModal(false);
                          }}
                          className="rounded-lg border border-blue-200 bg-white px-2 py-1 text-[10px] font-bold text-blue-700 transition hover:bg-blue-50"
                        >
                          날짜별 응답 보기
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {scheduled.map((idKey) => {
                          const member = memberDb[idKey];
                          const editDate = scheduledRosterDateInputs[idKey] ?? date;
                          return (
                            <div
                              key={idKey}
                              className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedScheduledRosterMembers((previous) => ({
                                        ...previous,
                                        [idKey]: !previous[idKey],
                                      }))
                                    }
                                    className="shrink-0"
                                    aria-label={`${member?.name || idKey.split('_')[0]} 메시지 수신 인원 선택`}
                                  >
                                    {selectedScheduledRosterMembers[idKey] ? (
                                      <CheckSquare className="h-4 w-4 text-blue-600" />
                                    ) : (
                                      <Square className="h-4 w-4 text-slate-300" />
                                    )}
                                  </button>
                                  <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-800">
                                    {member?.name || idKey.split('_')[0]}
                                    <span className="ml-1.5 font-mono text-[10px] text-blue-700">
                                      {member?.code || idKey.split('_')[1]}
                                    </span>
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-slate-400">
                                    {member?.part || WORK_PART_OPTIONS[0]}
                                  </p>
                                  </div>
                                </div>
                                <span className="shrink-0 rounded-lg bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-700">
                                  출근 예정
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                                <label className="text-[10px] font-bold text-slate-500" htmlFor={`scheduled-date-${idKey}`}>
                                  예정일 변경
                                </label>
                                <input
                                  id={`scheduled-date-${idKey}`}
                                  type="date"
                                  value={editDate}
                                  onChange={(event) =>
                                    setScheduledRosterDateInputs((previous) => ({
                                      ...previous,
                                      [idKey]: event.target.value,
                                    }))
                                  }
                                  disabled={isSavingScheduledWorkDate}
                                  className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700"
                                />
                                <button
                                  type="button"
                                  onClick={() => saveSelectedScheduledWorkDate([idKey], editDate)}
                                  disabled={isSavingScheduledWorkDate || !editDate || editDate === date}
                                  className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  변경 저장
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveSelectedScheduledWorkDate([idKey], null)}
                                  disabled={isSavingScheduledWorkDate}
                                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                                >
                                  예정 해제
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))
                )}
              </div>

              <button
                onClick={() => setShowScheduledRosterModal(false)}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl text-xs"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {showConfirmedModal && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
              className="bg-white w-full rounded-3xl p-5 shadow-2xl space-y-4 max-h-[500px] flex flex-col border border-slate-200"
              onTouchStart={handleAvailabilitySwipeStart}
              onTouchEnd={handleAvailabilitySwipeEnd}
            >
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex min-w-0 items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <button
                    type="button"
                    onClick={() => shiftAvailabilityDate(-1)}
                    disabled={selectedAvailabilityDate === 'all'}
                    className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 disabled:opacity-40"
                    aria-label="이전 날짜"
                    title="이전 날짜"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <h3 className="min-w-0 text-center font-bold text-slate-900 text-xs sm:text-sm">
                    출근 응답 명단 · {formatDateLabel(selectedAvailabilityDate)} ({confirmedCount}명)
                  </h3>
                  <button
                    type="button"
                    onClick={() => shiftAvailabilityDate(1)}
                    disabled={selectedAvailabilityDate === 'all'}
                    className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 disabled:opacity-40"
                    aria-label="다음 날짜"
                    title="다음 날짜"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <button onClick={() => setShowConfirmedModal(false)} className="text-slate-400 text-sm font-bold">
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {confirmedList.length > 0 && (
                  <div className="sticky top-0 z-10 space-y-2 bg-white py-1">
                    <button
                      onClick={toggleSelectAllConfirmed}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 hover:text-blue-600 transition"
                    >
                      {isAllConfirmedSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                      전체 선택 ({selectedConfirmedCount}/{confirmedCount})
                    </button>
                    {selectedConfirmedCount > 0 && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setGroupMessageRecipientKeys(
                                confirmedList.filter(
                                  (idKey) =>
                                    selectedConfirmedMembers[getConfirmedSelectionKey(selectedAvailabilityDate, idKey)]
                                )
                              );
                              setShowGroupMsgModal(true);
                            }}
                            className="justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold px-2 py-2 rounded-lg text-[11px] flex items-center gap-1 transition shadow-sm"
                          >
                            <Send className="w-3.5 h-3.5" /> 선택 인원에게 메시지 ({selectedConfirmedCount})
                          </button>
                          <button
                            onClick={() => handleDownloadSelectedConfirmed()}
                            className="justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-2 rounded-lg text-[11px] flex items-center gap-1 transition shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5" /> 엑셀 다운로드 ({selectedConfirmedCount})
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 p-2">
                          <span className="text-[11px] font-bold text-blue-800">
                            선택 {selectedConfirmedCount}명 예정일 지정
                          </span>
                          <input
                            type="date"
                            value={scheduledWorkDateInputs[selectedAvailabilityDate] || selectedAvailabilityDate}
                            onChange={(event) =>
                              setScheduledWorkDateInputs((previous) => ({
                                ...previous,
                                [selectedAvailabilityDate]: event.target.value,
                              }))
                            }
                            className="min-w-0 rounded-lg border border-blue-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700"
                            aria-label={`${formatDateLabel(selectedAvailabilityDate)} 출근 응답 선택 인원 예정일`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const selectedKeys = confirmedList.filter(
                                (idKey) =>
                                  selectedConfirmedMembers[getConfirmedSelectionKey(selectedAvailabilityDate, idKey)]
                              );
                              saveSelectedScheduledWorkDate(
                                selectedKeys,
                                scheduledWorkDateInputs[selectedAvailabilityDate] || selectedAvailabilityDate
                              );
                            }}
                            disabled={isSavingScheduledWorkDate}
                            className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
                          >
                            {isSavingScheduledWorkDate ? '저장 중...' : '예정일 저장'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const selectedKeys = confirmedList.filter(
                                (idKey) =>
                                  selectedConfirmedMembers[getConfirmedSelectionKey(selectedAvailabilityDate, idKey)]
                              );
                              saveSelectedScheduledWorkDate(selectedKeys, null);
                            }}
                            disabled={isSavingScheduledWorkDate}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                          >
                            예정 해제
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {confirmedList.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs font-medium">
                    아직 출근 가능을 제출한 지원자가 없습니다.
                  </div>
                ) : (
                  confirmedList.map((idKey) => {
                    const member = memberDb[idKey];
                    const selectionKey = getConfirmedSelectionKey(selectedAvailabilityDate, idKey);
                    return (
                      <div key={idKey} className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setSelectedConfirmedMembers((prev) => ({
                                ...prev,
                                [selectionKey]: !prev[selectionKey],
                              }))
                            }
                            className="text-slate-400"
                            aria-label={`${member?.name || idKey.split('_')[0]} 선택`}
                          >
                            {selectedConfirmedMembers[selectionKey] ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </button>
                          <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800">{member?.name || idKey.split('_')[0]}</span>
                            <span className="font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                              {member?.code || idKey.split('_')[1]}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{member?.part || WORK_PART_OPTIONS[0]}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {member?.scheduledWorkDate && (
                            <span className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                              {`${Number(member.scheduledWorkDate.slice(5, 7))}월 ${Number(member.scheduledWorkDate.slice(8, 10))}일 출근 예정`}
                            </span>
                          )}
                          <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded-lg text-[10px]">
                            출근 가능
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <button
                onClick={() => setShowConfirmedModal(false)}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl text-xs"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {showGroupMsgModal && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full rounded-3xl p-5 shadow-2xl space-y-4 border border-slate-200">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-blue-600" /> 선택 인원 메시지 단체 전송
                </h3>
                <button onClick={() => setShowGroupMsgModal(false)} className="text-slate-400 text-sm font-bold">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSendGroupMessage} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">
                    선택한 {groupMessageRecipientKeys.length}명에게 보낼 메시지
                  </label>
                  <textarea
                    rows={4}
                    placeholder="내용을 입력하세요..."
                    required
                    value={groupMsgText}
                    onChange={(e) => setGroupMsgText(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500 leading-relaxed resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-xs transition shadow-md shadow-blue-500/20"
                >
                  {groupMessageRecipientKeys.length}명에게 동시에 전송
                </button>
              </form>
            </div>
          </div>
        )}

        {showLoginHistoryModal && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full rounded-3xl p-5 shadow-2xl space-y-4 border border-slate-200">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" /> 접속 현황 및 시각 확인
                </h3>
                <button onClick={() => setShowLoginHistoryModal(false)} className="text-slate-400 text-sm font-bold">
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-bold text-slate-900">{memberDb[historyTargetKey]?.name || '지원자'}</span>
                    <span className="font-mono text-blue-600 font-bold">{memberDb[historyTargetKey]?.code || '-'}</span>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span>현재 접속 상태:</span>
                    <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      memberDb[historyTargetKey]?.isOnline 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {memberDb[historyTargetKey]?.isOnline ? '🟢 접속중 (Online)' : '⚪ 미접속 (Offline)'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span>최근 접속 일시:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {memberDb[historyTargetKey]?.lastLoginAt
                        ? new Date(memberDb[historyTargetKey]!.lastLoginAt!).toLocaleString()
                        : '접속 기록 없음 (미접속)'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowLoginHistoryModal(false)}
                className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {showAdminManageModal && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full rounded-3xl p-5 shadow-2xl space-y-4 max-h-[550px] flex flex-col border border-slate-200 overflow-hidden">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <UserCog className="w-4 h-4 text-emerald-600" /> 관리자 계정 설정
                </h3>
                <button onClick={() => setShowAdminManageModal(false)} className="text-slate-400 text-sm font-bold">
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddAdmin} className="bg-slate-50 p-3.5 rounded-2xl space-y-2.5 text-xs border border-slate-200">
                <p className="font-bold text-slate-800">➕ 신규 관리자 계정 추가</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="관리자 성명"
                    required
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    className="w-full min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="password"
                    placeholder="비밀번호"
                    required
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    className="w-full min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-xl transition"
                >
                  관리자 계정 등록
                </button>
              </form>

              <div className="flex-1 overflow-y-auto space-y-2">
                <p className="text-xs font-bold text-slate-600">등록된 관리자 목록 ({Object.keys(adminDb).length}명)</p>
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl p-2 bg-white">
                  {Object.keys(adminDb).map((admName) => (
                    <div key={admName} className="py-2 px-1 flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{admName}</span>
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                          관리자 권한
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteAdmin(admName)}
                        className="text-slate-300 hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowAdminManageModal(false)}
                className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {showAnnouncePopup && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full rounded-3xl p-5 shadow-2xl space-y-4 max-h-[500px] flex flex-col border border-slate-200">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-blue-600" /> {role === 'admin' ? '공지 목록 관리' : '전체 공지사항 알림'}
                </h3>
                <button onClick={() => setShowAnnouncePopup(false)} className="text-slate-400 text-sm font-bold">
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3">
                {announcements.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs font-medium">
                    등록된 전체 공지사항이 없습니다.
                  </div>
                ) : (
                  announcements.map((item) => (
                    <div key={item.id} className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-1.5 relative">
                      <div className="flex justify-between items-center pr-6">
                        <span className="text-[11px] font-bold text-blue-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-blue-500" /> {item.title}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                        {item.content}
                      </p>

                      {role === 'admin' && (
                        <button
                          onClick={() => handleDeleteAnnouncement(item.id)}
                          className="absolute top-3 right-3 text-slate-300 hover:text-red-500 p-1 transition"
                          title="공지 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => setShowAnnouncePopup(false)}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl text-xs"
              >
                {role === 'admin' ? '닫기' : '확인 완료'}
              </button>
            </div>
          </div>
        )}

        {showAppSelectModal && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="app-select-title"
              className="bg-white w-full rounded-3xl p-5 shadow-2xl space-y-4 border border-slate-200"
            >
              <div className="flex justify-between items-center border-b pb-3">
                <h3 id="app-select-title" className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-emerald-600" /> ONE-HR 앱 다운로드 📲
                </h3>
                <button
                  onClick={() => setShowAppSelectModal(false)}
                  className="text-slate-400 text-sm font-bold"
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>
              <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-100 p-4 text-center">
                <div className="text-3xl mb-2" aria-hidden="true">📱✨</div>
                <p className="text-sm font-bold text-slate-800">ONE-HR로 편리하게 확인하세요!</p>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  출퇴근과 근무 관련 정보를 확인할 수 있도록<br />휴대전화에 맞는 앱을 설치해 주세요.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigateToStore('android')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl text-xs transition shadow-sm"
                >
                  <span className="block text-lg mb-1" aria-hidden="true">🤖</span>
                  삼성 · Android
                  <span className="block text-[10px] font-medium opacity-80 mt-1">▶ Google Play 스토어</span>
                </button>
                <button
                  onClick={() => navigateToStore('ios')}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl text-xs transition shadow-sm"
                >
                  <span className="block text-lg mb-1" aria-hidden="true">🍎</span>
                  Apple · iPhone
                  <span className="block text-[10px] font-medium opacity-80 mt-1">🍎 App Store</span>
                </button>
              </div>
              <button
                onClick={() => setShowAppSelectModal(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-xs transition"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {showBroadcastModal && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full rounded-3xl p-5 shadow-2xl space-y-4 border border-slate-200">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Megaphone className="w-4 h-4 text-amber-600" /> 전체 공지 알림 작성
                </h3>
                <button onClick={() => setShowBroadcastModal(false)} className="text-slate-400 text-sm font-bold">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSendBroadcast} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">공지 내용 입력</label>
                  <textarea
                    rows={4}
                    placeholder="예) 내일 우천으로 인하여 셔틀버스 출발 시간이 10분 앞당겨집니다."
                    required
                    value={broadcastNotice}
                    onChange={(e) => setBroadcastNotice(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-amber-500 leading-relaxed resize-none"
                  />
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl text-xs transition shadow-md shadow-amber-500/20"
                  >
                    종 모양(🔔) 알림으로 전체 공지 발송
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showChatModal && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3">
            <div className="bg-white w-full rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[580px] border border-slate-200">
              <div className="bg-slate-900 text-white p-3.5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                    {role === 'admin' ? (memberDb[chatTargetWorkerKey]?.name || '지')[0] : '올'}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs">
                      {role === 'admin' 
                        ? `${memberDb[chatTargetWorkerKey]?.name || '지원자'} (${memberDb[chatTargetWorkerKey]?.code || '코드'}) 대화`
                        : '1:1 상담 및 AI 챗봇'
                      }
                    </h4>
                    <p className="text-[10px] text-slate-400">실시간 상담 창</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowChatModal(false);
                    if (role === 'worker') markAsRead(userUniqueKey);
                  }}
                  className="text-slate-400 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div ref={chatMessagesContainerRef} className="flex-1 min-h-0 p-3.5 bg-slate-50 overflow-y-auto overscroll-contain space-y-2.5 font-sans text-xs">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-20 text-[11px] text-slate-400 font-medium leading-relaxed">
                    🤖 (주)올품 챗봇에게 셔틀버스, 근무시간, 주소, 급여일 등을 물어보세요!<br />
                    (기타 상세 문의: ☎️ 054-450-8618)
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div 
                      key={idx} 
                      className={`flex flex-col ${
                        role === 'admin'
                          ? (msg.sender_role === 'admin' ? 'items-end' : 'items-start')
                          : (msg.sender_role === 'worker' ? 'items-end' : 'items-start')
                      }`}
                    >
                      <span className="text-[10px] text-slate-400 font-medium mb-0.5">
                        {msg.sender_role === 'admin' ? '담당 관리자/AI' : (memberDb[msg.sender_name]?.name || userName)}
                      </span>
                      <div className={`px-3 py-2 rounded-2xl text-xs max-w-[220px] leading-relaxed shadow-sm whitespace-pre-wrap ${
                        (role === 'admin' && msg.sender_role === 'admin') || (role === 'worker' && msg.sender_role === 'worker')
                          ? 'bg-blue-600 text-white rounded-tr-none font-medium' 
                          : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none font-medium'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendMessage} className="p-3 bg-white flex gap-2 border-t border-slate-200">
                <input
                  type="text"
                  placeholder="질문 또는 메시지 입력..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-medium"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-sm flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" /> 전송
                </button>
              </form>
            </div>
          </div>
        )}

        {showAddMemberModal && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full rounded-3xl p-5 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-600" /> 신규 지원자 코드 직접 발급
                </h3>
                <button onClick={() => setShowAddMemberModal(false)} className="text-slate-400 text-sm font-bold">
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddMember} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">지원자 성명</label>
                  <input
                    type="text"
                    placeholder="성함 입력 (예: 박경현)"
                    required
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">전화번호 뒷자리 (개인 전용 코드)</label>
                  <input
                    type="text"
                    placeholder="전화번호 뒷자리 4자리 (예: 7841)"
                    required
                    value={newMemberCode}
                    onChange={(e) => setNewMemberCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">근무 파트</label>
                  <select
                    value={newMemberPart}
                    onChange={(e) => setNewMemberPart(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    {WORK_PART_OPTIONS.map((part) => (
                      <option key={part} value={part}>{part}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl text-xs transition shadow-md shadow-emerald-500/20"
                  >
                    코드 발급 및 명단 등록
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeModal === 'shuttle' && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full rounded-3xl p-5 shadow-2xl space-y-4 max-h-[580px] flex flex-col border border-slate-200">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Bus className="w-4 h-4 text-blue-600" /> (주)올품 셔틀버스 노선 안내
                </h3>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 text-sm font-bold">
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 text-xs text-slate-600 pr-1">
                <div className="bg-blue-50 p-3.5 rounded-2xl border border-blue-100 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-blue-900">☀️ 주간조 출근 1호차 (시청/터미널)</span>
                    <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded font-bold">07:10 출발</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-blue-950">
                    07:10 시청역 2번 출구 ➔ 07:25 터미널 맞은편 ➔ 07:45 (주)올품 본사 도착
                  </p>
                </div>

                <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-emerald-900">☀️ 주간조 출근 2호차 (주공/상주역)</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold">07:15 출발</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-emerald-950">
                    07:15 주공아파트 정문 ➔ 07:30 상주역 입구 ➔ 07:45 (주)올품 본사 도착
                  </p>
                </div>

                <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-100 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-purple-900">🌙 야간조 출근 셔틀</span>
                    <span className="text-[10px] bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded font-bold">22:10 출발</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-purple-950">
                    22:10 시청역 2번 출구 / 터미널 경유 ➔ 22:45 (주)올품 본사 도착
                  </p>
                </div>

                <div className="bg-slate-100 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-800">🚌 퇴근 셔틀 안내</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    • 주간조 퇴근: 17:40 통근버스 승차장 출발<br />
                    • 야간조 퇴근: 08:40 통근버스 승차장 출발
                  </p>
                </div>

                <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 flex items-center gap-2 text-amber-900">
                  <Phone className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-bold text-[11px]">담당 관리자 문의전화</p>
                    <p className="text-[11px] font-mono font-bold">☎️ 054-450-8618</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveModal(null)}
                className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs mt-1"
              >
                확인 완료
              </button>
            </div>
          </div>
        )}

        {activeModal === 'guide' && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full rounded-3xl p-5 shadow-2xl space-y-4 max-h-[560px] flex flex-col border border-slate-200">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-blue-600" /> 🎉 첫 출근 가이드
                </h3>
                <button onClick={closeGuideModal} className="text-slate-400 text-sm font-bold">
                  ✕
                </button>
              </div>

              {isFirstLoginGuide && (
                <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                  👋 처음 오신 것을 환영합니다! 첫 출근 전에 아래 내용을 확인해 주세요.
                </p>
              )}

              <div className="flex-1 overflow-y-auto space-y-3 text-xs text-slate-700 leading-relaxed pr-1">
                <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-100">
                  <p className="font-bold text-blue-900 mb-1 flex items-center gap-1">
                    ⏰ 1. 출근 시간 준수
                  </p>
                  <p className="text-slate-600">
                    원활한 준비를 위해 **출근 시간 10분 전까지** 도착해 주시기 바랍니다.
                  </p>
                </div>

                <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-100">
                  <p className="font-bold text-emerald-900 mb-1 flex items-center gap-1">
                    📄 2. 첫 출근 지참 서류
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    • **신분증 사본**<br />
                    • **보건증 사본**<br />
                    • **주민등록등본**<br />
                    ※ 첫 출근 시 위 서류들을 반드시 지참하여 제출해 주세요.
                  </p>
                </div>

                <div className="bg-purple-50/70 p-3.5 rounded-2xl border border-purple-100">
                  <p className="font-bold text-purple-900 mb-1 flex items-center gap-1">
                    🎓 3. 첫날 교육 및 업무 배정
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    첫째 날은 **기본 교육을 진행**합니다. 교육이 완료된 후 **생산 담당 관리자가 직접 인솔하여 업무에 배정**될 예정입니다.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={hideGuideForToday}
                  className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold py-2.5 rounded-xl text-[11px] transition"
                >
                  오늘 하루 안 보기
                </button>
                <button
                  onClick={neverShowGuideAgain}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-[11px] transition"
                >
                  다신 안 보기
                </button>
              </div>
              <button
                onClick={closeGuideModal}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl text-xs"
              >
                확인 완료
              </button>
            </div>
          </div>
        )}

        {activeModal === 'resignation' && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full rounded-3xl p-5 shadow-2xl space-y-4 max-h-[560px] flex flex-col border border-slate-200">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-600" /> 퇴직 절차 안내
                </h3>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 text-sm font-bold" aria-label="퇴직 절차 안내 닫기">
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 text-xs text-slate-700 leading-relaxed pr-1">
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  마지막 근무일과 필요한 절차는 근무 상황에 따라 다를 수 있으니 담당 관리자와 먼저 확인해 주세요.
                </p>
                <div className="bg-blue-50 p-3.5 rounded-2xl border border-blue-100">
                  <p className="font-bold text-blue-900 mb-1">1. 퇴직 의사와 마지막 근무일 알리기</p>
                  <p className="text-slate-600">
                    담당 관리자에게 퇴직 의사와 희망하는 마지막 근무일을 미리 전달하고, 남은 근무 일정과 퇴직일을 확인해 주세요.
                  </p>
                </div>
                <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100">
                  <p className="font-bold text-emerald-900 mb-1">2. 반납할 물품 확인하기</p>
                  <p className="text-slate-600">
                    지급받은 작업복, 출입증 또는 기타 회사 물품이 있다면 반납 방법과 기한을 관리자에게 확인해 주세요.
                  </p>
                </div>
                <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-100">
                  <p className="font-bold text-purple-900 mb-1">3. 근무·급여 정산 확인하기</p>
                  <p className="text-slate-600">
                    실제 마지막 근무일과 근무 내역을 확인하고, 급여 정산 및 필요한 서류가 있는지 담당 관리자에게 문의해 주세요.
                  </p>
                </div>
                <div className="bg-red-50 p-3.5 rounded-2xl border border-red-100">
                  <p className="font-bold text-red-900 mb-1">회원 탈퇴와 퇴직은 별도입니다</p>
                  <p className="text-slate-600">
                    빠른 메뉴의 [회원 탈퇴]는 앱 계정을 삭제하는 기능이며 퇴직 신청이나 근무 일정 취소를 대신하지 않습니다. 퇴직 관련 확인을 마친 뒤 이용해 주세요.
                  </p>
                </div>
                <div className="bg-slate-100 p-3.5 rounded-2xl border border-slate-200">
                  <p className="font-bold text-slate-800">담당 관리자 문의</p>
                  <p className="text-slate-600">☎️ 054-450-8618</p>
                </div>
              </div>

              <button
                onClick={() => setActiveModal(null)}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl text-xs"
              >
                확인 완료
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}