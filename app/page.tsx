'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Bus, Bell, Key, User, ShieldCheck, AlertTriangle, BookOpen, Info, Plus, Trash2, Users, Send, MessageSquare, X, Megaphone, CheckCircle, FileSpreadsheet, CheckSquare, Square, UserCog, Bot, Phone, FileText, Check, Search, UserMinus, UserCheck, LogOut, ChevronRight, Clock, Download, Smartphone } from 'lucide-react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

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

interface MemberItem { idKey: string; name: string; code: string; part: string; isJoined?: boolean; isOnline?: boolean; lastLoginAt?: string | null; }
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

  const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfZdBbWY7B26JVyus9qlmglVFNh-oZ791GCFU9MJ0-5wu28tw/viewform?usp=dialog";

  const [memberDb, setMemberDb] = useState<{ [idKey: string]: MemberItem }>({});
  const [adminDb, setAdminDb] = useState<{ [key: string]: true }>({});

  const [memberSearchTerm, setMemberSearchTerm] = useState<string>('');
  const [showAdminManageModal, setShowAdminManageModal] = useState<boolean>(false);
  const [newAdminName, setNewAdminName] = useState<string>('');
  const [newAdminPassword, setNewAdminPassword] = useState<string>('');

  const [selectedMembers, setSelectedMembers] = useState<{ [idKey: string]: boolean }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showAddMemberModal, setShowAddMemberModal] = useState<boolean>(false);
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberCode, setNewMemberCode] = useState<string>('');
  const [newMemberPart, setNewMemberPart] = useState<string>('포장 · 주간조');

  const [showBroadcastModal, setShowBroadcastModal] = useState<boolean>(false);
  const [broadcastNotice, setBroadcastNotice] = useState<string>('');
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [showAnnouncePopup, setShowAnnouncePopup] = useState<boolean>(false);
  const [hasUnreadAnnounce, setHasUnreadAnnounce] = useState<boolean>(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState<boolean>(false);

  const [showConfirmedModal, setShowConfirmedModal] = useState<boolean>(false);
  const [selectedConfirmedMembers, setSelectedConfirmedMembers] = useState<{ [idKey: string]: boolean }>({});
  const [showGroupMsgModal, setShowGroupMsgModal] = useState<boolean>(false);
  const [groupMsgText, setGroupMsgText] = useState<string>('');

  const [showLoginHistoryModal, setShowLoginHistoryModal] = useState<boolean>(false);
  const [historyTargetKey, setHistoryTargetKey] = useState<string>('');
  const [showAppSelectModal, setShowAppSelectModal] = useState<boolean>(false);

  const [loginName, setLoginName] = useState<string>('');
  const [loginCode, setLoginCode] = useState<string>('');
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [isLockedOut, setIsLockedOut] = useState<boolean>(false);
  const [selectedAvailabilityDate, setSelectedAvailabilityDate] = useState<string>(() => getAvailabilityDateKey());
  const [availabilityRecords, setAvailabilityRecords] = useState<AvailabilityItem[]>([]);

  const [userName, setUserName] = useState<string>('');
  const [userCode, setUserCode] = useState<string>('');
  const [userPart, setUserPart] = useState<string>('');

  const [showChatModal, setShowChatModal] = useState<boolean>(false);
  const [chatTargetWorkerKey, setChatTargetWorkerKey] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<MessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [unreadCounts, setUnreadCounts] = useState<{ [idKey: string]: number }>({});
  const [latestWorkerMessageAt, setLatestWorkerMessageAt] = useState<{ [idKey: string]: string }>({});
  const [unreadWorkerMessages, setUnreadWorkerMessages] = useState<{ [idKey: string]: MessageItem }>({});
  const [adminIncomingMessage, setAdminIncomingMessage] = useState<MessageItem | null>(null);
  const [workerIncomingNotification, setWorkerIncomingNotification] = useState<WorkerIncomingNotification | null>(null);
  const [showAdminNotificationMenu, setShowAdminNotificationMenu] = useState<boolean>(false);

  const [activeModal, setActiveModal] = useState<'shuttle' | 'guide' | null>(null);
  const [isFirstLoginGuide, setIsFirstLoginGuide] = useState(false);
  const welcomeMessageRequests = useRef(new Set<string>());
  const seenWorkerMessageIds = useRef(new Set<number>());
  const hasInitializedAdminMessages = useRef(false);
  const seenAdminMessageIds = useRef(new Set<number>());
  const hasInitializedWorkerMessages = useRef(false);
  const seenAnnouncementIds = useRef(new Set<number>());
  const hasInitializedWorkerAnnouncements = useRef(false);

  const userUniqueKey = `${userName}_${userCode}`;
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

    availabilityRecords.forEach((record) => {
      const date = getAvailabilityDateKey(new Date(record.created_at));
      if (!responsesByDate[date]) responsesByDate[date] = {};
      responsesByDate[date][record.worker_name] = record.status;
    });

    return Array.from(new Set([getAvailabilityDateKey(), ...Object.keys(responsesByDate)]))
      .sort((dateA, dateB) => dateB.localeCompare(dateA))
      .map((date) => {
        const responses = responsesByDate[date] || {};
        return {
          date,
          responses,
          possible: Object.keys(responses).filter((workerKey) => responses[workerKey] === 'possible'),
          impossible: Object.keys(responses).filter((workerKey) => responses[workerKey] === 'impossible'),
        };
      });
  }, [availabilityRecords]);
  const availabilityDates = useMemo(() => {
    const dates = new Set([getAvailabilityDateKey()]);
    availabilityRecords.forEach((record) => dates.add(getAvailabilityDateKey(new Date(record.created_at))));
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [availabilityRecords]);

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
            isJoined: item.is_joined === true, isOnline: item.is_online === true, lastLoginAt: item.last_login_at
          };
        });
        setMemberDb(dbMap);
      }
    } catch (err) {}
  };

  const fetchCounts = async () => {
    if (!supabase) return;
    try {
      const { data: availData, error } = await supabase
        .from('work_availabilities')
        .select('worker_name, status, created_at')
        .order('created_at', { ascending: true });
      if (error) {
        console.error('출근 응답 기록 조회 실패:', error.message);
        return;
      }
      if (availData) setAvailabilityRecords(availData);
    } catch (error) {
      console.error('출근 응답 기록 조회 실패:', error);
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
    if (confirm(`⚠️ 정말로 탈퇴하시겠습니까?\n\n탈퇴 시 명단 및 개인 전용 코드가 삭제되며, 추후 재가입 및 생성이 어려울 수 있습니다.`)) {
      if (supabase) { await supabase.from('members').delete().match({ name: userName, code: userCode }); }
      alert('탈퇴가 완료되었습니다.');
      handleLogout();
    }
  };

  const toggleJoinStatus = async (idKey: string) => {
    const target = memberDb[idKey];
    if (!target || !supabase) return;
    const nextStatus = !target.isJoined;
    await supabase.from('members').update({ is_joined: nextStatus }).match({ name: target.name, code: target.code });
    fetchMembers();
  };

  const handleSendGroupMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = groupMsgText.trim();
    const selectedKeys = Object.keys(selectedMembers).filter(k => selectedMembers[k]);

    if (!text || selectedKeys.length === 0 || !supabase) return;

    const msgBatch = selectedKeys.map(k => ({ sender_name: '관리자', sender_role: 'admin', receiver_name: k, message: text, is_read: false }));
    const { error } = await supabase.from('messages').insert(msgBatch);
    if (error) {
      alert(`메시지 전송에 실패했습니다: ${error.message}`);
      return;
    }
    alert(`📩 선택한 ${selectedKeys.length}명 지원자에게 메시지가 동시 전송되었습니다.`);
    setGroupMsgText(''); setShowGroupMsgModal(false); setSelectedMembers({}); fetchMessages();
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
        const part = assignedPart ?? '포장 · 주간조';
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
  const toggleSelectAll = () => {
    const allKeys = Object.keys(memberDb);
    const isAllSelected = allKeys.every(idKey => selectedMembers[idKey]);
    const updated: { [idKey: string]: boolean } = {};
    allKeys.forEach(idKey => { updated[idKey] = !isAllSelected; });
    setSelectedMembers(updated);
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
        입사상태: member.isJoined ? '입사완료' : '지원자',
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
        if (shouldSelectAll) updated[idKey] = true;
        else delete updated[idKey];
      });
      return updated;
    });
  };

  const handleDownloadSelectedConfirmed = () => {
    const selectedKeys = confirmedList.filter((idKey) => selectedConfirmedMembers[idKey]);
    if (selectedKeys.length === 0) {
      alert('엑셀로 다운로드할 출근 확정 인원을 선택해 주세요.');
      return;
    }

    const exportRows = selectedKeys.map((idKey) => {
      const member = memberDb[idKey];
      return {
        응답일: selectedAvailabilityDate,
        성명: member?.name || idKey.split('_')[0],
        코드: member?.code || idKey.split('_')[1] || '',
        근무파트: member?.part || '포장 · 주간조',
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

    XLSX.writeFile(workbook, `출근_응답명단_${selectedAvailabilityDate.replace(/-/g, '')}.xlsx`);
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
    if (!cleanName || !cleanCode || !supabase) return;

    await supabase.from('members').insert([{ name: cleanName, code: cleanCode, part: newMemberPart, is_joined: false, is_online: false }]);
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

  const handleResponse = async (status: 'possible' | 'impossible') => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('work_availabilities').insert([{ worker_name: userUniqueKey, status }]);
      if (error) {
        alert(`출근 응답 저장에 실패했습니다: ${error.message}`);
        return;
      }
      alert(status === 'possible' ? '출근 가능으로 제출되었습니다!' : '어려움으로 제출되었습니다.');
      await fetchCounts();
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      alert(`출근 응답 저장에 실패했습니다: ${message}`);
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
  const activeMemberCount = sortedKeys.filter((idKey) => !memberDb[idKey]?.isJoined).length;
  const joinedMemberCount = sortedKeys.filter((idKey) => memberDb[idKey]?.isJoined).length;

  const isAllChecked = allKeys.length > 0 && allKeys.every(idKey => selectedMembers[idKey]);
  const selectedCount = Object.values(selectedMembers).filter(Boolean).length;

  const confirmedList = allKeys.filter(idKey => workerResponses[idKey] === 'possible');
  const confirmedCount = confirmedList.length;
  const selectedConfirmedCount = confirmedList.filter(idKey => selectedConfirmedMembers[idKey]).length;
  const isAllConfirmedSelected = confirmedList.length > 0 && selectedConfirmedCount === confirmedList.length;
  const targetTotal = allKeys.length;
  const pendingCount = allKeys.filter(idKey => !workerResponses[idKey] || workerResponses[idKey] === 'none').length;

  const workDateString = getNextWorkDateInfo();
  const activeViewMode = role === 'admin' ? adminViewTab : 'worker';

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 font-sans text-slate-800">
      {isLoggedIn && role === 'admin' && (
        <div className="max-w-md mx-auto mb-4 flex justify-end items-center text-xs">
          <div className="flex gap-2">
            <button
              onClick={() => setAdminViewTab('worker')}
              className={`px-3 py-1.5 rounded-full font-bold transition ${
                adminViewTab === 'worker' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              지원자 화면 보기
            </button>
            <button
              onClick={() => setAdminViewTab('admin')}
              className={`px-3 py-1.5 rounded-full font-bold transition relative ${
                adminViewTab === 'admin' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              관리자 화면 보기
              {totalAdminUnread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {totalAdminUnread}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto bg-slate-50 min-h-[780px] rounded-[3rem] border-[8px] border-slate-900 shadow-2xl overflow-hidden relative p-5">
        <div className="w-32 h-4 bg-slate-900 mx-auto rounded-b-xl mb-4"></div>

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
                <span className="text-xs font-black tracking-widest text-blue-600 uppercase flex items-center justify-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> SHIFTMATE
                </span>
                <h1 className="text-2xl font-black text-slate-900 mt-1">(주)올품 출근 안내</h1>
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
                <span className="text-xs font-black tracking-wider text-blue-600">(주)올품 SHIFTMATE</span>
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
              <p className="text-xs text-slate-400 mb-5">오후 6시까지 출근 여부를 제출해 주세요.</p>

              <div className="flex gap-2.5 mb-4">
                <button
                  onClick={() => handleResponse('possible')}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${
                    workerResponses[userUniqueKey] === 'possible' ? 'bg-blue-500 text-white ring-2 ring-blue-300' : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  출근 가능
                </button>
                <button
                  onClick={() => handleResponse('impossible')}
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
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-black tracking-wider text-blue-600">(주)올품 ADMIN</span>
                <h1 className="text-lg font-bold">{userName}님, 안녕하세요</h1>
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

            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl">
              <p className="text-xs text-slate-400 font-medium mb-1">다음 근무 · {workDateString}</p>
              <div className="flex items-center justify-between gap-2 mb-3">
                <label htmlFor="availability-response-date" className="text-xs font-bold text-slate-300 shrink-0">
                  응답 누른 날짜
                </label>
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
              </div>
              {selectedAvailabilityDate === 'all' ? (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {availabilityByDate.map(({ date, possible, impossible }) => (
                    <div key={date} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h2 className="text-sm font-black">{formatDateLabel(date)}</h2>
                        <button
                          onClick={() => setSelectedAvailabilityDate(date)}
                          className="text-[10px] font-bold text-blue-300 hover:text-white"
                        >
                          자세히 보기
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-300 mb-2">
                        출근 가능 {possible.length}명 · 출근 불가 {impossible.length}명 · 미응답 {Math.max(targetTotal - possible.length - impossible.length, 0)}명
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
                      {possible.length === 0 && impossible.length === 0 && (
                        <p className="text-[10px] text-slate-400">아직 응답이 없습니다.</p>
                      )}
                    </div>
                  ))}
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

                  <button
                    onClick={() => setShowConfirmedModal(true)}
                    className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold text-sm text-white transition shadow-lg shadow-blue-900/50"
                  >
                    출근 명단 확인 · {formatDateLabel(selectedAvailabilityDate)} ({confirmedCount}명)
                  </button>
                </>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200/80 p-3.5 rounded-2xl flex items-center justify-between gap-2">
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

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
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
                  <span>선택 ({selectedCount}/{allKeys.length})</span>
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
                      onClick={() => setShowGroupMsgModal(true)}
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

              <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {sortedKeys.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs font-medium">
                    {memberSearchTerm ? `'${memberSearchTerm}' 검색 결과가 없습니다.` : '등록된 지원자가 없습니다.'}
                  </div>
                ) : (
                  sortedKeys.map((idKey, index) => {
                    const member = memberDb[idKey];
                    if (!member) return null;

                    const unreadCount = unreadCounts[idKey] || 0;
                    const workerStatus = workerResponses[idKey] || 'none';
                    const isChecked = !!selectedMembers[idKey];
                    const online = member.isOnline === true;

                    return (
                      <React.Fragment key={idKey}>
                      {(index === 0 || !!memberDb[sortedKeys[index - 1]]?.isJoined !== !!member.isJoined) && (
                        <div className={`flex items-center justify-between px-2 py-2.5 ${
                          index === 0 ? '' : 'border-t-2 border-slate-200'
                        } ${member.isJoined ? 'bg-emerald-50/70' : 'bg-slate-50/80'}`}>
                          <div>
                            <div className={`flex items-center gap-1.5 text-[11px] font-bold ${
                              member.isJoined ? 'text-emerald-800' : 'text-slate-600'
                            }`}>
                              {member.isJoined
                                ? <UserCheck className="w-3.5 h-3.5" />
                                : <Users className="w-3.5 h-3.5" />}
                              {member.isJoined ? '입사 완료 인원' : '지원자'}
                            </div>
                            <span className={`text-[10px] font-bold ${
                              member.isJoined ? 'text-emerald-700' : 'text-slate-500'
                            }`}>
                              {member.isJoined ? joinedMemberCount : activeMemberCount}명
                            </span>
                          </div>
                          {(() => {
                            const groupKeys = sortedKeys.filter(
                              (key) => !!memberDb[key]?.isJoined === !!member.isJoined
                            );
                            const selectedGroupCount = groupKeys.filter((key) => selectedMembers[key]).length;
                            const isGroupSelected = groupKeys.length > 0 && selectedGroupCount === groupKeys.length;
                            return (
                              <button
                                onClick={() => toggleSelectMembers(groupKeys)}
                                className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition ${
                                  member.isJoined
                                    ? 'text-emerald-800 hover:bg-emerald-100'
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
                        member.isJoined ? 'bg-emerald-50/30' : ''
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
                            <p className="text-[11px] text-slate-400 mt-0.5">{member.part}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toggleJoinStatus(idKey)}
                            className={`font-bold px-2 py-1.5 rounded-xl text-[11px] transition ${
                              member.isJoined
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600'
                            }`}
                            title="입사 상태 변경"
                          >
                            {member.isJoined ? '입사완료' : '입사'}
                          </button>

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

        {showConfirmedModal && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full rounded-3xl p-5 shadow-2xl space-y-4 max-h-[500px] flex flex-col border border-slate-200">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" /> 출근 응답 명단 · {formatDateLabel(selectedAvailabilityDate)} ({confirmedCount}명)
                </h3>
                <button onClick={() => setShowConfirmedModal(false)} className="text-slate-400 text-sm font-bold">
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2">
                {confirmedList.length > 0 && (
                  <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-white py-1">
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
                      <button
                        onClick={handleDownloadSelectedConfirmed}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-1 transition shadow-sm"
                      >
                        <Download className="w-3 h-3" /> 엑셀 다운로드 ({selectedConfirmedCount})
                      </button>
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
                    return (
                      <div key={idKey} className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedConfirmedMembers((prev) => ({ ...prev, [idKey]: !prev[idKey] }))}
                            className="text-slate-400"
                            aria-label={`${member?.name || idKey.split('_')[0]} 선택`}
                          >
                            {selectedConfirmedMembers[idKey] ? (
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
                          <p className="text-[10px] text-slate-400 mt-0.5">{member?.part || '포장 · 주간조'}</p>
                          </div>
                        </div>
                        <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded-lg text-[10px]">
                          출근 가능
                        </span>
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
                  <Send className="w-4 h-4 text-blue-600" /> 선택 지원자 메시지 단체 전송
                </h3>
                <button onClick={() => setShowGroupMsgModal(false)} className="text-slate-400 text-sm font-bold">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSendGroupMessage} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">
                    선택한 {selectedCount}명에게 보낼 메시지
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
                  {selectedCount}명에게 동시에 전송
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

              <div className="flex-1 p-3.5 bg-slate-50 overflow-y-auto space-y-2.5 font-sans text-xs">
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
                    <option value="포장 · 주간조">포장 · 주간조</option>
                    <option value="물류/분류 · 주간조">물류/분류 · 주간조</option>
                    <option value="포장 · 야간조">포장 · 야간조</option>
                    <option value="피킹/검수 · 주간조">피킹/검수 · 주간조</option>
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
      </div>
    </div>
  );
}