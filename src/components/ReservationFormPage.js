'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Clock, Users, MapPin, X } from 'lucide-react';
import { useRooms } from '../contexts/RoomContext';
import PasswordModal from './PasswordModal';
import DeleteScopeModal from './DeleteScopeModal';
import { getLocalDateTime } from '@/lib/roomData';

const ReservationFormPage = () => {
  const { schedule } = useRooms();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');
  const editId = searchParams.get('editId');
  const prefilledStartPeriodId = searchParams.get('startPeriodId');
  const prefilledEndPeriodId = searchParams.get('endPeriodId');
  const isEditing = !!editId;

  // Schulstunden-Definitionen - nutzt Schedule aus Context
  const getSchoolPeriods = useCallback(() => {
    console.log('ReservationFormPage - Schedule from Context:', schedule); // Debug
    
    return schedule.map(slot => ({
      id: slot.id,
      name: slot.name,
      startHour: parseInt(slot.startTime.split(':')[0]),
      startTime: slot.startTime,
      endTime: slot.endTime,
      time: `${slot.startTime} - ${slot.endTime}`
    }));
  }, [schedule]);

  // Sichere Parser/Formatter für lokale Daten (verhindert UTC-Shift bei 'YYYY-MM-DD')
  const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const formatLocalDate = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Hilfsfunktion um die korrekten Start- und Endzeiten für Schulstunden zu berechnen
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const calculateSchoolHourTimes = useCallback((startPeriodId, endPeriodId, date) => {
    console.log('calculateSchoolHourTimes called with:', { startPeriodId, endPeriodId, date });
    
    // Validierung der Eingabeparameter
    if (!startPeriodId || !endPeriodId || !date) {
      console.error('Periode nicht gefunden: Fehlende Parameter', { startPeriodId, endPeriodId, date });
      return null;
    }
    
    const periods = getSchoolPeriods();
    
    // Finde Start-Periode basierend auf ID
    const startPeriod = periods.find(p => p.id === parseInt(startPeriodId));
    
    // Finde End-Periode basierend auf ID
    const endPeriod = periods.find(p => p.id === parseInt(endPeriodId));
    
    if (!startPeriod || !endPeriod) {
      console.error('Periode nicht gefunden:', { 
        startPeriodId: parseInt(startPeriodId), 
        endPeriodId: parseInt(endPeriodId), 
        startPeriod: startPeriod || 'undefined', 
        endPeriod: endPeriod || 'undefined',
        availablePeriods: periods.map(p => ({ id: p.id, name: p.name }))
      });
      return null;
    }
    
    // Start-Zeit aus der Periode verwenden
    const [startH, startM] = startPeriod.startTime.split(':').map(Number);
  const startDateTime = parseLocalDate(date);
    startDateTime.setHours(startH, startM, 0, 0);
    
    // End-Zeit aus der Periode verwenden
    const [endH, endM] = endPeriod.endTime.split(':').map(Number);
  const endDateTime = parseLocalDate(date);
    endDateTime.setHours(endH, endM, 0, 0);
    
    console.log('Berechnete Zeiten:', {
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString()
    });
    
    return { startDateTime, endDateTime };
  }, [getSchoolPeriods]);
  const [formData, setFormData] = useState(() => {
    // URL-Parameter für vorausgefüllte Daten
    const prefilledDate = searchParams.get('date');
  const prefilledStartHour = searchParams.get('startHour');
  const prefilledEndHour = searchParams.get('endHour');
    
    // Konvertiere Stunden zu Periode-IDs falls verfügbar
    const periods = Array.isArray(schedule) ? schedule.map(slot => ({ id: slot.id })) : [];

    const defaultStartPeriod = prefilledStartPeriodId
      ? periods.find(p => p.id === parseInt(prefilledStartPeriodId))
      : (periods[0] || null);
    const defaultEndPeriod = prefilledEndPeriodId
      ? periods.find(p => p.id === parseInt(prefilledEndPeriodId))
      : (periods[0] || null);
    
    return {
      roomId: roomId || '',
      title: '',
      date: prefilledDate || new Date().toISOString().slice(0, 10),
  startPeriod: defaultStartPeriod?.id || (periods[0]?.id || 1),
  endPeriod: defaultEndPeriod?.id || (periods[0]?.id || 1),
      description: '',
      recurrenceType: 'once',
      weeklyCount: 1
    };
  });

  // Deletion password UI state
  const [requireDeletionPassword, setRequireDeletionPassword] = useState(false);
  const [deletionPassword, setDeletionPassword] = useState('');
  const [editingHasDeletionPassword, setEditingHasDeletionPassword] = useState(false);
  
  const [errors, setErrors] = useState({});
  const [editLoaded, setEditLoaded] = useState(!isEditing); // Verhindert Flackern
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [conflicts, setConflicts] = useState([]);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didPrefillFromURL, setDidPrefillFromURL] = useState(false);
  const submitLockRef = useRef(false);
  const releaseSubmitLock = () => { submitLockRef.current = false; setIsSubmitting(false); };
  
  const [passwordModal, setPasswordModal] = useState({ open: false, purpose: null });
  const [pendingAction, setPendingAction] = useState(null);
  const openPwdModal = (purpose, action) => { setPasswordModal({ open: true, purpose }); setPendingAction(()=>action); };
  const closePwdModal = () => { setPasswordModal(prev=>({ ...prev, open:false })); setPendingAction(null); };
  const cancelPwdModal = () => { closePwdModal(); releaseSubmitLock(); };
  const handlePwdSubmit = (pwd) => { if (pendingAction) pendingAction(pwd); closePwdModal(); };
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Serien-Metadaten (nur gesetzt falls Termin Teil einer Serie ist)
  const [seriesId, setSeriesId] = useState(null);
  const [seriesIndex, setSeriesIndex] = useState(null);
  const [seriesTotal, setSeriesTotal] = useState(null);
  // Auswahl für Änderungsbereich bei Serien bzw. Serie-ähnlichen Gruppen
  const [scopeSelection, setScopeSelection] = useState('single'); // 'single' | 'series-all' | 'time-future'
  // Übersicht aller Termine der Serie
  const [seriesMembers, setSeriesMembers] = useState([]);
  const [seriesMembersLoading, setSeriesMembersLoading] = useState(false);
  const [showSeriesMembers, setShowSeriesMembers] = useState(true);
  // Serie-ähnliche Gruppe (wenn keine seriesId vorhanden ist)
  const [patternMembers, setPatternMembers] = useState([]);
  const [patternMembersLoading, setPatternMembersLoading] = useState(false);
  const [showPatternMembers, setShowPatternMembers] = useState(true);
  
  // Beim Laden prüfen ob ein zwischengespeichertes Edit-Passwort existiert
  useEffect(()=>{ 
    if (isEditing && editId) { 
      try { 
        const stored = sessionStorage.getItem('reservationEditPwd_'+editId); 
        if (stored) { 
          setDeletionPassword(stored); 
          sessionStorage.removeItem('reservationEditPwd_'+editId);
        }
      } catch(e){}
    } 
  }, [isEditing, editId]);

  // Wenn Seriendaten gesetzt wurden, alle Serientermine laden (zur Übersicht im Formular)
  useEffect(() => {
    const loadSeriesMembers = async (sid) => {
      if (!sid) { setSeriesMembers([]); return; }
      setSeriesMembersLoading(true);
      try {
        const resp = await fetch('/api/reservations');
        if (resp.ok) {
          const json = await resp.json();
          const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
          const members = list.filter(r => r.seriesId === sid);
          members.sort((a,b)=> new Date(a.startTime) - new Date(b.startTime));
          setSeriesMembers(members);
        } else {
          setSeriesMembers([]);
        }
      } catch (_) {
        setSeriesMembers([]);
      } finally {
        setSeriesMembersLoading(false);
      }
    };
    if (seriesId) loadSeriesMembers(seriesId);
  }, [seriesId]);

  // Wenn KEINE seriesId: versuche, eine Serie-ähnliche Gruppe zu erkennen (gleicher Raum, gleicher Wochentag & genaue Uhrzeiten)
  useEffect(() => {
    const detectPatternMembers = async () => {
      if (!isEditing || !editId || seriesId) { setPatternMembers([]); setPatternMembersLoading(false); return; }
      // Wir brauchen Basisdaten des aktuellen Termins (Raum, Datum, Start/End HH:MM)
      try {
        const resp = await fetch('/api/reservations');
        if (!resp.ok) { setPatternMembers([]); return; }
        const json = await resp.json();
        const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        const current = list.find(r => parseInt(r.id) === parseInt(editId));
        if (!current) { setPatternMembers([]); return; }
        const roomIdNum = parseInt(current.roomId);
        const start = new Date(current.startTime);
        const end = new Date(current.endTime);
        const weekday = start.getDay();
        const toHHMM = (d) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        const startHHMM = toHHMM(start);
        const endHHMM = toHHMM(end);
        const toMinutes = (d) => d.getHours()*60 + d.getMinutes();
        const curStartMin = toMinutes(start);
        const curEndMin = toMinutes(end);
        const stripWeekSuffix = (t) => t.replace(/ \(Woche \d+\/\d+\)$/,'').trim();
        const baseTitle = stripWeekSuffix(current.title || '');
        const tolerance = 3; // Minuten
        // Filter: gleicher Raum, gleicher Wochentag, gleiche HH:MM Start/Ende (lokal), beliebiges Datum
        const pm = list.filter(r => {
          if (parseInt(r.id) === parseInt(editId)) return true; // aktuellen einschließen
          if (parseInt(r.roomId) !== roomIdNum) return false;
          const s = new Date(r.startTime); const e = new Date(r.endTime);
          if (s.getDay() !== weekday) return false;
          const sh = toHHMM(s); const eh = toHHMM(e);
          const sMin = toMinutes(s); const eMin = toMinutes(e);
          const titleMatch = stripWeekSuffix(r.title || '') === baseTitle;
          const timeClose = Math.abs(sMin - curStartMin) <= tolerance && Math.abs(eMin - curEndMin) <= tolerance;
          return (sh === startHHMM && eh === endHHMM) || timeClose || titleMatch;
        }).sort((a,b)=> new Date(a.startTime) - new Date(b.startTime));
        // Nur setzen, wenn sich die Länge geändert hat (einfacher Guard)
        setPatternMembers(prev => (prev.length !== pm.length ? pm : prev));
      } catch (_) {
        setPatternMembers([]);
      } finally {
        setPatternMembersLoading(false);
      }
    };
    setPatternMembersLoading(true);
    detectPatternMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, editId, seriesId]);

  // Räume von der API laden
  useEffect(() => {
    const loadRooms = async () => {
      try {
        const response = await fetch('/api/rooms');
        if (response.ok) {
          const data = await response.json();
          setRooms(Array.isArray(data) ? data : []);
        } else {
          console.error('Fehler beim Laden der Räume');
          setRooms([]);
        }
      } catch (error) {
        console.error('Fehler beim Laden der Räume:', error);
        setRooms([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRooms();
  }, []);

  // WICHTIG: Prefill der Perioden aus URL erst NACHDEM der Schedule geladen ist,
  // damit nicht fälschlich die erste Periode genommen wird.
  useEffect(() => {
    if (isEditing) return; // Bei Bearbeitung nicht überschreiben
    if (didPrefillFromURL) return; // Nur einmal ausführen
    if (!schedule || schedule.length === 0) return; // Warten bis Schedule verfügbar

    const periods = schedule.map(slot => ({
      id: slot.id,
      startHour: parseInt(slot.startTime.split(':')[0])
    }));

    let newStart = formData.startPeriod;
    let newEnd = formData.endPeriod;

    if (prefilledStartPeriodId) {
      const p = periods.find(p => p.id === parseInt(prefilledStartPeriodId));
      if (p) newStart = p.id;
    } else if (searchParams.get('startHour')) {
      const hour = parseInt(searchParams.get('startHour'));
      const p = periods.find(p => p.startHour === hour);
      if (p) newStart = p.id;
    }

    if (prefilledEndPeriodId) {
      const p = periods.find(p => p.id === parseInt(prefilledEndPeriodId));
      if (p) newEnd = p.id;
    } else if (searchParams.get('endHour')) {
      const hour = parseInt(searchParams.get('endHour'));
      const p = periods.find(p => p.startHour === hour);
      if (p) newEnd = p.id;
    }

    setFormData(prev => ({ ...prev, startPeriod: newStart, endPeriod: newEnd }));
    setDidPrefillFromURL(true);
  }, [schedule, isEditing, didPrefillFromURL, prefilledStartPeriodId, prefilledEndPeriodId, searchParams]);

  // Konflikterkennung
  const checkTimeConflicts = useCallback(async (roomId, startPeriodId, endPeriodId, date, excludeId = null) => {
    if (!roomId || !startPeriodId || !endPeriodId || !date) {
      setConflicts([]);
      return { hasConflict: false, conflicts: [] };
    }

    // Nur anzeigen wenn wirklich geprüft wird
    setIsCheckingConflicts(true);
    
    try {
      const timeResult = calculateSchoolHourTimes(startPeriodId, endPeriodId, date);
      if (!timeResult) {
        setConflicts([]);
        return { hasConflict: false, conflicts: [] };
      }

      const { startDateTime, endDateTime } = timeResult;

      const response = await fetch('/api/reservations/check-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: parseInt(roomId),
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          excludeId: excludeId
        })
      });

      if (response.ok) {
        const result = await response.json();
        setConflicts(result.conflicts || []);
        return result;
      } else {
        console.error('Fehler bei Konfliktprüfung');
        setConflicts([]);
        return { hasConflict: false, conflicts: [] };
      }
    } catch (error) {
      console.error('Fehler bei Konfliktprüfung:', error);
      setConflicts([]);
      return { hasConflict: false, conflicts: [] };
    } finally {
      setIsCheckingConflicts(false);
    }
  }, [calculateSchoolHourTimes]);

  // Automatische Konflikterkennung bei Änderungen
  useEffect(() => {
    // Reset conflicts wenn nicht alle Felder ausgefüllt sind
    if (!formData.roomId || !formData.startPeriod || !formData.endPeriod || !formData.date) {
      setConflicts([]);
      setIsCheckingConflicts(false);
      return;
    }

    const checkConflicts = async () => {
      await checkTimeConflicts(
        formData.roomId, 
        formData.startPeriod, 
        formData.endPeriod, 
        formData.date,
        isEditing ? editId : null
      );
    };

    // Längerer Debounce von 1,2 Sekunden um Flackern zu verhindern
    const timeoutId = setTimeout(checkConflicts, 1200);
    return () => clearTimeout(timeoutId);
  }, [formData.roomId, formData.startPeriod, formData.endPeriod, formData.date, isEditing, editId, checkTimeConflicts]);
  
  const room = rooms.find(r => r.id === parseInt(roomId));

  // Lade Bearbeitungsdaten vom Hauptfenster
  useEffect(() => {
    if (isEditing && window.opener) {
      console.log('Bearbeitungsmodus - lade Daten für ID:', editId); // Debug
      
      // Frage Bearbeitungsdaten vom Hauptfenster an
      window.opener.postMessage({
        type: 'GET_RESERVATION_DATA',
        payload: editId
      }, window.location.origin);
      
      // Höre auf die Antwort
      const handleMessage = (event) => {
        console.log('Bearbeitungsfenster: Nachricht empfangen:', event.data); // Debug
        
        if (event.origin !== window.location.origin) return;
        
  if (event.data.type === 'RESERVATION_DATA' && event.data.payload) {
          const reservation = event.data.payload;
          console.log('Lade Reservierungsdaten:', reservation); // Debug
          
          const startTime = getLocalDateTime(reservation, 'start') || new Date(reservation.startTime);
          const endTime = getLocalDateTime(reservation, 'end') || new Date(reservation.endTime);
          
          // Entferne Wochennummer aus dem Titel falls vorhanden
          const cleanTitle = reservation.title.replace(/ \(Woche \d+\/\d+\)/, '');
          
          // Finde passende Perioden basierend auf der Zeit
          const periods = getSchoolPeriods();
          const startHour = startTime.getHours();
          const endHour = endTime.getHours();
          
          const startPeriod = periods.find(p => p.startHour === startHour);
          const endPeriod = periods.find(p => p.startHour === endHour);
          
          console.log('Setze Formulardaten:', {
            roomId: reservation.roomId.toString(),
            title: cleanTitle,
            date: reservation.date || startTime.toISOString().slice(0, 10),
            startPeriod: startPeriod?.id || periods[0]?.id,
            endPeriod: endPeriod?.id || periods[1]?.id,
            description: reservation.description || ''
          }); // Debug
          
          setFormData({
            roomId: reservation.roomId.toString(),
            title: cleanTitle,
            date: reservation.date || startTime.toISOString().slice(0, 10),
            startPeriod: startPeriod?.id || periods[0]?.id,
            endPeriod: endPeriod?.id || periods[1]?.id,
            description: reservation.description || '',
            recurrenceType: 'once', // Immer einmalig bei Bearbeitung
            weeklyCount: 1
          });
          // Serieninfos übernehmen (falls vorhanden)
          if (reservation.seriesId) {
            setSeriesId(reservation.seriesId);
            setSeriesIndex(reservation.seriesIndex || null);
            setSeriesTotal(reservation.seriesTotal || null);
            setScopeSelection('single');
          } else {
            setSeriesId(null); setSeriesIndex(null); setSeriesTotal(null);
            setScopeSelection('single');
          }
          // Setze Lösch-Passwort UI-Status (Passwort selbst wird nie übertragen)
          setEditingHasDeletionPassword(!!reservation.hasDeletionPassword);
          setRequireDeletionPassword(!!reservation.hasDeletionPassword);
          setDeletionPassword('');
          setEditLoaded(true);
        }
      };
      
      window.addEventListener('message', handleMessage, { once: false });
      return () => window.removeEventListener('message', handleMessage);
    }
    // Fallback falls opener nicht verfügbar (direkter Aufruf oder Popup Blocker)
    if (isEditing && !window.opener) {
      (async () => {
        try {
          const resp = await fetch('/api/reservations');
          if (resp.ok) {
            const json = await resp.json();
            const list = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
            const reservation = list.find(r => parseInt(r.id) === parseInt(editId));
            if (reservation) {
              const startTime = getLocalDateTime(reservation, 'start') || new Date(reservation.startTime);
              const periods = getSchoolPeriods();
              const startHour = startTime.getHours();
              const startPeriod = periods.find(p => p.startHour === startHour);
              const endTime = getLocalDateTime(reservation, 'end') || new Date(reservation.endTime);
              const endHour = endTime.getHours();
              const endPeriod = periods.find(p => p.startHour === endHour);
              setFormData(fd => ({
                ...fd,
                roomId: reservation.roomId.toString(),
                title: reservation.title,
                date: reservation.date || startTime.toISOString().slice(0,10),
                startPeriod: startPeriod?.id || fd.startPeriod,
                endPeriod: endPeriod?.id || fd.endPeriod,
                description: reservation.description || ''
              }));
              // Set deletion-password flags for fallback-loaded edit
              setEditingHasDeletionPassword(!!reservation.hasDeletionPassword);
              setRequireDeletionPassword(!!reservation.hasDeletionPassword);
              setDeletionPassword('');
              if (reservation.seriesId) {
                setSeriesId(reservation.seriesId);
                setSeriesIndex(reservation.seriesIndex || null);
                setSeriesTotal(reservation.seriesTotal || null);
                setScopeSelection('single');
              } else {
                setSeriesId(null); setSeriesIndex(null); setSeriesTotal(null);
                setScopeSelection('single');
              }
            }
          }
        } catch(e) { /* ignore */ }
        setEditLoaded(true);
      })();
    }
  }, [isEditing, editId, getSchoolPeriods]);

  const validateForm = async () => {
    const newErrors = {};
    
    if (!formData.roomId || formData.roomId === '') newErrors.roomId = 'Raum ist erforderlich';
    if (!formData.title) newErrors.title = 'Titel ist erforderlich';
    if (!formData.date) newErrors.date = 'Datum ist erforderlich';
    if (!formData.startPeriod) newErrors.startPeriod = 'Startperiode ist erforderlich';
    if (!formData.endPeriod) newErrors.endPeriod = 'Endperiode ist erforderlich';
    
    // Überprüfe ob End-Periode nach Start-Periode liegt (basierend auf Zeit)
    if (formData.startPeriod && formData.endPeriod) {
      const periods = getSchoolPeriods();
      const startPeriod = periods.find(p => p.id === parseInt(formData.startPeriod));
      const endPeriod = periods.find(p => p.id === parseInt(formData.endPeriod));
      
      if (startPeriod && endPeriod) {
        // Vergleiche die Start-Zeit der Startperiode mit der Start-Zeit der Endperiode
        const startTime = startPeriod.startTime;
        const endTime = endPeriod.startTime;
        
        // Konvertiere zu Minuten für einfachen Vergleich
        const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
        const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
        
        if (startMinutes > endMinutes) {
          newErrors.endPeriod = 'Endperiode muss nach oder gleich der Startperiode liegen';
        }
      }
    }
    
    if (formData.recurrenceType === 'weekly' && (!formData.weeklyCount || formData.weeklyCount < 1)) {
      newErrors.weeklyCount = 'Anzahl Wochen muss mindestens 1 sein';
    }

    // Konflikterkennung
    if (formData.roomId && formData.startPeriod && formData.endPeriod && formData.date) {
      const conflictResult = await checkTimeConflicts(
        formData.roomId, 
        formData.startPeriod, 
        formData.endPeriod, 
        formData.date,
        isEditing ? editId : null
      );
      
      if (conflictResult.hasConflict) {
        const conflictMessages = conflictResult.conflicts.map(conflict => 
          `&quot;${conflict.title}&quot; (${conflict.timeDisplay})`
        ).join(', ');
        newErrors.timeConflict = `Zeitkonflikt mit: ${conflictMessages}`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLockRef.current || isSubmitting) return; // Doppel-Klick Sperre (sofort, synchron)
    submitLockRef.current = true;
    setIsSubmitting(true);
    
    const proceed = async (pwdFromModal) => {
      if (pwdFromModal && !deletionPassword) setDeletionPassword(pwdFromModal);
      const isValid = await validateForm();
      if (!isValid) { releaseSubmitLock(); return; }
      
      if (isEditing) {
        // Bearbeitung: Update existierende Reservierung
        const timeResult = calculateSchoolHourTimes(
          formData.startPeriod, 
          formData.endPeriod, 
          formData.date
        );
        
        if (!timeResult) {
          alert('Fehler beim Berechnen der Zeiten. Bitte überprüfen Sie Ihre Eingaben.');
          releaseSubmitLock();
          return;
        }
        
        const { startDateTime, endDateTime } = timeResult;
        
        const updatedReservation = {
          id: parseInt(editId),
          roomId: parseInt(formData.roomId),
          title: formData.title,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          description: formData.description || ''
        };
        // Serienfelder weitergeben (für Backend-Logik)
        // Serienfelder, falls vorhanden, mitgeben
        if (seriesId) {
          updatedReservation.seriesId = seriesId;
          updatedReservation.seriesIndex = seriesIndex;
          updatedReservation.seriesTotal = seriesTotal;
        }
        // Scope-Auswahl IMMER übernehmen (API akzeptiert 'time-future' ohne seriesId)
        updatedReservation.scope = scopeSelection || 'single';
        // Wenn der Termin geschützt ist oder der Nutzer verlangt, ein Löschpasswort zu setzen,
        // stelle sicher, dass wir ein Passwort haben: frage ggf. per prompt nach.
        if (editingHasDeletionPassword || requireDeletionPassword) {
          let pwd = deletionPassword;
          if (!pwd || pwd.length === 0) {
            pwd = prompt('Dieser Termin ist geschützt. Bitte Passwort zum Bearbeiten eingeben:');
            if (pwd === null) return; // Abbrechen
            setDeletionPassword(pwd);
          }
          updatedReservation.deletionPassword = pwd;
          updatedReservation.requireDeletionPassword = true;
        }
        
        // Sende Update an das Hauptfenster
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            type: 'UPDATE_RESERVATION',
            payload: updatedReservation
          }, window.location.origin);
          
          setTimeout(() => {
            alert('Reservierung erfolgreich aktualisiert!');
            window.close();
          }, 100);
        } else {
          alert('Verbindung zum Hauptfenster verloren. Bitte versuchen Sie es erneut.');
          releaseSubmitLock();
        }
        
        return;
      }
      
  // Rest der Funktion für neue Reservierungen bleibt gleich
      const reservationsToCreate = [];
      const baseId = Date.now();
      const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      
      if (formData.recurrenceType === 'once') {
        // Einmalige Reservierung
        const timeResult = calculateSchoolHourTimes(
          formData.startPeriod, 
          formData.endPeriod, 
          formData.date
        );
        
        if (!timeResult) {
          alert('Fehler beim Berechnen der Zeiten. Bitte überprüfen Sie Ihre Eingaben.');
          releaseSubmitLock();
          return;
        }
        
        const { startDateTime, endDateTime } = timeResult;
        
        const reservationData = {
          id: baseId,
          roomId: parseInt(formData.roomId),
          title: formData.title,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          description: formData.description || ''
          ,requireDeletionPassword: requireDeletionPassword,
          deletionPassword: deletionPassword
        };
        
        reservationsToCreate.push(reservationData);
      } else if (formData.recurrenceType === 'weekly') {
        // Wöchentliche Reservierungen erstellen (mit paralleler Vorab-Konfliktprüfung)
        const weeklyCount = parseInt(formData.weeklyCount);
        // Eine einzige seriesId für alle erzeugten Wochen
        const newSeriesId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'series-' + Date.now() + '-' + Math.random().toString(36).slice(2,10);
        
        const baseDate = parseLocalDate(formData.date);
        // 1) Vorab-Konfliktprüfung parallel durchführen
        const weeks = Array.from({ length: weeklyCount }, (_, i) => i);
        const weeklyChecks = await Promise.all(weeks.map(async (week) => {
          const weeklyDate = new Date(baseDate);
          weeklyDate.setDate(baseDate.getDate() + (week * 7));
          const dateStr = formatLocalDate(weeklyDate);
          const timeResult = calculateSchoolHourTimes(formData.startPeriod, formData.endPeriod, dateStr);
          if (!timeResult) {
            return { week, dateStr, error: `Fehler beim Berechnen der Zeiten für Woche ${week + 1}.` };
          }
          const { startDateTime, endDateTime } = timeResult;
          try {
            const resp = await fetch('/api/reservations/check-conflict', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomId: parseInt(formData.roomId),
                startTime: startDateTime.toISOString(),
                endTime: endDateTime.toISOString(),
                excludeId: null
              })
            });
            let result = { hasConflict: false, conflicts: [] };
            if (resp.ok) {
              result = await resp.json();
            }
            return { week, dateStr, startDateTime, endDateTime, result };
          } catch (_) {
            // Bei Fehler die Woche als konfliktfrei behandeln, um nicht zu blockieren
            return { week, dateStr, startDateTime, endDateTime, result: { hasConflict: false, conflicts: [] } };
          }
        }));
        // Abbruch wenn Berechnungsfehler auftraten
        const anyCalcError = weeklyChecks.find(x => x && x.error);
        if (anyCalcError) {
          alert(anyCalcError.error + ' Bitte Eingaben prüfen.');
          setIsSubmitting(false);
          return;
        }

        const conflicting = weeklyChecks.filter(c => c.result?.hasConflict);
        const nonConflicting = weeklyChecks.filter(c => !c.result?.hasConflict);
        if (conflicting.length > 0) {
          const lines = conflicting.slice(0, 7).map(c => {
            const details = (c.result.conflicts || []).map(x => `"${x.title}" (${x.timeDisplay || ''})`).join(', ');
            return `- Woche ${c.week + 1} (${c.dateStr})${details ? ': ' + details : ''}`;
          }).join('\n');
          const more = conflicting.length > 7 ? `\n… und ${conflicting.length - 7} weitere` : '';
          const msg = `Es wurden Konflikte in ${conflicting.length} Woche(n) gefunden:\n${lines}${more}\n\nNur konfliktfreie Wochen anlegen?`;
          const proceedOnlyFree = confirm(msg);
          if (!proceedOnlyFree) {
            return; // Abbruch durch Nutzer
          }
        }

        // 2) Nur konfliktfreie Wochen tatsächlich anlegen
        for (const c of nonConflicting) {
          const week = c.week;
          const reservationData = {
            id: baseId + week + 1,
            roomId: parseInt(formData.roomId),
            title: `${formData.title} (Woche ${week + 1}/${weeklyCount})`,
            startTime: c.startDateTime.toISOString(),
            endTime: c.endDateTime.toISOString(),
            description: formData.description || '',
            requireDeletionPassword: requireDeletionPassword,
            deletionPassword: deletionPassword,
            seriesId: newSeriesId,
            seriesIndex: week + 1,
            seriesTotal: weeklyCount
          };
          reservationsToCreate.push(reservationData);
        }
        if (reservationsToCreate.length === 0) {
          alert('Keine Reservierungen angelegt, da alle Wochen Konflikte hatten.');
          return;
        }
      }
      
      console.log('Sende Reservierungen:', reservationsToCreate); // Debug
      
      // Sende Daten an das Hauptfenster und warte auf Ergebnis
      if (window.opener && !window.opener.closed) {
        return await new Promise((resolve) => {
          let done = false;
          const finalize = (message) => {
            if (done) return; done = true; resolve();
            alert(message);
            window.close();
          };

          const onResult = (event) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type !== 'ADD_RESERVATIONS_RESULT') return;
            if (event.data?.batchId && event.data.batchId !== batchId) return; // Nur auf mein Batch reagieren
            window.removeEventListener('message', onResult);
            const { successes = [], failures = [] } = event.data.payload || {};
            const successCount = successes.length;
            const failCount = failures.length;
            const failLines = failures.slice(0, 5).map(f => `- ${f.title}: ${f.error}`).join('\n');
            const more = failures.length > 5 ? `\n… und ${failures.length - 5} weitere Fehler` : '';
            const msg = failCount === 0
              ? `${successCount} Reservierung(en) erfolgreich erstellt.`
              : `${successCount} erstellt, ${failCount} fehlgeschlagen:\n${failLines}${more}`;
            finalize(msg);
          };

          window.addEventListener('message', onResult);
          window.opener.postMessage({ type: 'ADD_RESERVATIONS', batchId, payload: reservationsToCreate }, window.location.origin);

          // Fallback: Timeout, falls keine Antwort kommt (z. B. ältere Hauptfenster-Version)
          setTimeout(() => finalize(`${reservationsToCreate.length} Reservierung(en) angefragt. Das Ergebnis wird ggf. später sichtbar.`), 3000);
        });
      } else {
        alert('Verbindung zum Hauptfenster verloren. Bitte versuchen Sie es erneut.');
        releaseSubmitLock();
      }
    };
    if (isEditing && (editingHasDeletionPassword || requireDeletionPassword) && !deletionPassword) {
      openPwdModal('edit', proceed);
      return;
    }
    await proceed();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Fehler für dieses Feld löschen
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleClose = () => {
    try {
      if (window.opener && !window.opener.closed) {
        window.close();
        return;
      }
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      window.location.href = '/';
    } catch (e) {
      window.location.href = '/';
    }
  };

  const performDelete = async (scope) => {
    if (!isEditing) return;
    try {
      const headers = {};
      // Wenn dieser Termin geschützt ist, frage ggf. nach Passwort
      if (editingHasDeletionPassword && (!deletionPassword || deletionPassword.length === 0)) {
        const pwd = prompt('Dieser Termin ist mit einem Löschpasswort geschützt. Bitte Passwort eingeben:');
        if (pwd === null) return; // abgebrochen
        setDeletionPassword(pwd);
        headers['x-deletion-password'] = pwd;
      } else if (deletionPassword && deletionPassword.length > 0) {
        headers['x-deletion-password'] = deletionPassword;
      }
      const scopeParam = scope && scope !== 'single' ? `&scope=${scope}` : '';
      let resp = await fetch(`/api/reservations?id=${editId}${scopeParam}`, { method: 'DELETE', headers });
      if (!resp.ok && resp.status === 403) {
        const msg = await resp.json().catch(()=>({}));
        if (msg && (msg.error || '').toLowerCase().includes('passwort')) {
          const pwd2 = prompt('Löschpasswort erforderlich. Bitte eingeben:');
          if (pwd2 !== null) {
            headers['x-deletion-password'] = pwd2;
            resp = await fetch(`/api/reservations?id=${editId}${scopeParam}`, { method: 'DELETE', headers });
          }
        }
      }
      if (resp.ok) {
        // Informiere Hauptfenster zum Neuladen
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'RESERVATION_DELETED', payload: parseInt(editId) }, window.location.origin);
        }
        setTimeout(()=> window.close(), 100);
      } else {
        const err = await resp.json().catch(()=>({}));
        alert('Löschen fehlgeschlagen: ' + (err.error || resp.status));
      }
    } catch(e) {
      alert('Netzwerkfehler beim Löschen');
    }
  };

  const handleDelete = () => {
    if (!isEditing) return;
    setDeleteModalOpen(true);
  };

  if (isEditing && !editLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600 text-lg animate-pulse">Lade Termin...</div>
      </div>
    );
  }

  return (
    <> 
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {isEditing ? '✏️ Termin bearbeiten' : '➕ Neuen Termin erstellen'}
              </h1>
              <p className="text-gray-600 text-sm">
                Wählen Sie den gewünschten Raum und die Zeit aus
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 p-2 hover:bg-white hover:bg-opacity-60 rounded-full transition-all duration-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-6 text-sm">
            {/* Raumauswahl */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
              <label className="block text-xs font-medium mb-1 text-gray-700 uppercase tracking-wide">
                <MapPin className="inline w-5 h-5 mr-2" />
                Raum:
              </label>
              <select
                name="roomId"
                value={formData.roomId}
                onChange={handleChange}
                disabled={isLoading}
                className={`w-full p-2.5 text-sm border rounded-md transition-all duration-150 ${
                  errors.roomId 
                    ? 'border-red-400 bg-red-50' 
                    : 'border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'
                } ${isLoading ? 'bg-gray-100' : 'bg-white'} h-10`}
              >
                <option value="">
                  {isLoading ? "Räume werden geladen..." : "-- Raum auswählen --"}
                </option>
                {!isLoading && [...rooms].sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'de', { sensitivity: 'base' })).map(room => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
              {errors.roomId && <p className="text-red-500 text-sm mt-2 ml-1">{errors.roomId}</p>}
              </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-gray-700 uppercase tracking-wide">
                📝 Titel:
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={`w-full p-2.5 text-sm border rounded-md transition-all duration-150 ${
                  errors.title 
                    ? 'border-red-400 bg-red-50' 
                    : 'border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'
                }`}
                placeholder="z.B. Mathematik 9a"
              />
              {errors.title && <p className="text-red-500 text-[11px] mt-1 ml-1">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-gray-700 uppercase tracking-wide">
                📅 Datum:
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className={`w-full p-2.5 text-sm border rounded-md transition-all duration-150 ${
                  errors.date 
                    ? 'border-red-400 bg-red-50' 
                    : 'border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'
                }`}
              />
              {errors.date && <p className="text-red-500 text-[11px] mt-1 ml-1">{errors.date}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700 uppercase tracking-wide">
                  <Clock className="inline w-5 h-5 mr-2" />
                  Von Periode:
                </label>
                <select
                  name="startPeriod"
                  value={formData.startPeriod}
                  onChange={handleChange}
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-md hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all duration-150 h-10"
                >
                  {getSchoolPeriods().map(period => (
                    <option key={period.id} value={period.id}>
                      {period.name} ({period.time})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-gray-700 uppercase tracking-wide">
                  <Clock className="inline w-5 h-5 mr-2" />
                  Bis Periode:
                </label>
                <select
                  name="endPeriod"
                  value={formData.endPeriod}
                  onChange={handleChange}
                  className={`w-full p-2.5 text-sm border rounded-md transition-all duration-150 h-10 ${
                    errors.endPeriod 
                      ? 'border-red-400 bg-red-50' 
                      : 'border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-200'
                  }`}
                >
                  {getSchoolPeriods().map(period => (
                    <option key={period.id} value={period.id}>
                      {period.name} ({period.time})
                    </option>
                  ))}
                </select>
                {errors.endPeriod && <p className="text-red-500 text-[11px] mt-1 ml-1">{errors.endPeriod}</p>}
              </div>
            </div>
            </div>

            {/* Nur Konflikte anzeigen, keine "Prüfe Zeit..."-Nachricht */}
            {conflicts.length > 0 && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-md text-xs">
                <h4 className="text-red-800 font-semibold mb-2">⚠️ Zeitkonflikt erkannt!</h4>
                <p className="text-red-700 mb-2">
                  Folgende Reservierungen überschneiden sich mit der gewählten Zeit: 
                </p>
                <ul className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {conflicts.map((conflict, index) => (
                    <li key={index} className="text-red-700 bg-red-100 px-2 py-1.5 rounded">
                      📅 &quot;{conflict.title}&quot; von {conflict.timeDisplay}
                    </li>
                  ))}
                </ul>
                <p className="text-red-700 mt-2 font-medium">
                  Bitte wählen Sie eine andere Zeit.
                </p>
              </div>
            )}

            {errors.timeConflict && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-md text-xs">
                <p className="text-red-700">⚠️ {errors.timeConflict}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-1 text-gray-700 uppercase tracking-wide">📝 Beschreibung: </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                className="w-full p-2.5 border border-gray-300 rounded-md text-sm transition-all duration-150 hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                placeholder="Zusätzliche Informationen..."
              />
            </div>

            {isEditing && (
              <div className="mb-6 border rounded-md border-gray-200">
                <div className="px-4 py-3 border-b bg-gray-50 rounded-t-md">
                  <div className="flex items-center justify-between">
                    <div>
                      {seriesId ? (
                        <>
                          <div className="font-semibold text-gray-900">Dieser Termin ist Teil einer Serie</div>
                          <div className="text-xs text-gray-600">Serie {seriesIndex || '?'}{seriesTotal?`/${seriesTotal}`:''} – Serien-ID: <span className="font-mono">{seriesId.slice(0,8)}…</span></div>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold text-gray-900">Serien-Optionen</div>
                          <div className="text-xs text-gray-600">{patternMembers.length > 0 ? `Mögliche Serie erkannt (ohne Serien-ID) – ${patternMembers.length} Termin(e) gefunden` : 'Keine Serien-ID vorhanden. Wir prüfen automatisch auf Serie-ähnliche Termine (gleicher Raum, Wochentag, Uhrzeit).'}</div>
                        </>
                      )}
                    </div>
                    {seriesId ? (
                      <button
                        type="button"
                        onClick={()=>setShowSeriesMembers(s=>!s)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >{showSeriesMembers ? 'Liste ausblenden' : `Alle Termine anzeigen (${seriesMembers.length||0})`}</button>
                    ) : (
                      <button
                        type="button"
                        onClick={()=>setShowPatternMembers(s=>!s)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >{showPatternMembers ? 'Liste ausblenden' : `Alle Termine anzeigen (${patternMembers.length||0})`}</button>
                    )}
                  </div>
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Änderungsbereich</div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <label className="inline-flex items-center gap-2">
                        <input type="radio" name="scope" value="single" checked={scopeSelection==='single'} onChange={() => setScopeSelection('single')} />
                        <span>Nur dieser Termin</span>
                      </label>
                      {seriesId && (
                        <label className="inline-flex items-center gap-2">
                          <input type="radio" name="scope" value="series-all" checked={scopeSelection==='series-all'} onChange={() => setScopeSelection('series-all')} />
                          <span>Ganze Serie</span>
                        </label>
                      )}
                      <label className="inline-flex items-center gap-2">
                        <input type="radio" name="scope" value="time-future" checked={scopeSelection==='time-future'} onChange={() => setScopeSelection('time-future')} />
                        <span>Alle zukünftigen (gleiche Uhrzeit in diesem Raum)</span>
                      </label>
                    </div>
                    {/* Serien-Analyse & -Reparatur entfernt */}
                    </div>
                  {seriesId && showSeriesMembers && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Alle Termine dieser Serie</div>
                      <div className="max-h-48 overflow-auto border border-gray-200 rounded">
                        {seriesMembersLoading ? (
                          <div className="p-3 text-sm text-gray-500">Lade…</div>
                        ) : seriesMembers.length === 0 ? (
                          <div className="p-3 text-sm text-gray-500">Keine weiteren Termine gefunden.</div>
                        ) : (
                          <ul className="divide-y">
                            {seriesMembers.map(m => {
                              const d = getLocalDateTime(m, 'start') || new Date(m.startTime);
                              const end = getLocalDateTime(m, 'end') || new Date(m.endTime);
                              const isCurrent = parseInt(m.id) === parseInt(editId);
                              return (
                                <li key={m.id} className={`px-3 py-2 text-sm ${isCurrent ? 'bg-blue-50' : ''}`}>
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-medium text-gray-900">{m.title}</div>
                                      <div className="text-gray-600 text-xs">{d.toLocaleDateString('de-DE')} · {d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})} – {end.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</div>
                                    </div>
                                    {typeof m.seriesIndex !== 'undefined' && typeof m.seriesTotal !== 'undefined' && (
                                      <div className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">{m.seriesIndex}/{m.seriesTotal}</div>
                                    )}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                  {!seriesId && showPatternMembers && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Serie-ähnliche Termine (gleiche Uhrzeit, gleicher Wochentag)</div>
                      <div className="max-h-48 overflow-auto border border-gray-200 rounded">
                        {patternMembersLoading ? (
                          <div className="p-3 text-sm text-gray-500">Lade…</div>
                        ) : patternMembers.length === 0 ? (
                          <div className="p-3 text-sm text-gray-500">Keine passenden Termine gefunden. Tipp: Zeit ggf. minutengenau angleichen (z. B. 10:55 statt 10:54).</div>
                        ) : (
                          <ul className="divide-y">
                            {patternMembers.map(m => {
                              const d = getLocalDateTime(m, 'start') || new Date(m.startTime);
                              const end = getLocalDateTime(m, 'end') || new Date(m.endTime);
                              const isCurrent = parseInt(m.id) === parseInt(editId);
                              return (
                                <li key={m.id} className={`px-3 py-2 text-sm ${isCurrent ? 'bg-blue-50' : ''}`}>
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="font-medium text-gray-900">{m.title}</div>
                                      <div className="text-gray-600 text-xs">{d.toLocaleDateString('de-DE')} · {d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})} – {end.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</div>
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Wiederholung - nur bei neuen Terminen */}
            {!isEditing && (
              <div className="bg-green-50 p-4 rounded-md border border-green-200 text-xs">
                <h4 className="text-sm font-semibold mb-3 text-gray-700">🔄 Wiederholung: </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      id="once"
                      name="recurrenceType"
                      value="once"
                      checked={formData.recurrenceType === 'once'}
                      onChange={handleChange}
                      className="w-4 h-4"
                    />
                    <label htmlFor="once" className="font-medium">📅 Einmalig</label>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      id="weekly"
                      name="recurrenceType"
                      value="weekly"
                      checked={formData.recurrenceType === 'weekly'}
                      onChange={handleChange}
                      className="w-4 h-4"
                    />
                    <label htmlFor="weekly" className="font-medium">📆 Wöchentlich wiederholen</label>
                  </div>

                  {formData.recurrenceType === 'weekly' && (
                    <div className="ml-6 flex items-center gap-3">
                      <label className="">Anzahl Wochen: </label>
                      <input
                        type="number"
                        name="weeklyCount"
                        value={formData.weeklyCount}
                        onChange={handleChange}
                        min="1"
                        max="52"
                        className="w-20 p-1.5 border border-gray-300 rounded text-center text-sm transition-all duration-150 hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                      />
                      <span className="text-gray-600">(max. 52 Wochen)</span>
                    </div>
                  )}
                </div>

                {/* Vorschau */}
                {formData.recurrenceType === 'weekly' && formData.date && formData.weeklyCount > 1 && (
                  <div className="mt-3 p-3 bg-white rounded border">
                    <h5 className="font-medium mb-2 text-gray-700">📋 Vorschau der Termine: </h5>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {Array.from({ length: Math.min(parseInt(formData.weeklyCount) || 1, 10) }, (_, week) => {
                        const date = new Date(formData.date);
                        date.setDate(date.getDate() + (week * 7));
                        const periods = getSchoolPeriods();
                        const startPeriod = periods.find(p => p.id === parseInt(formData.startPeriod));
                        const endPeriod = periods.find(p => p.id === parseInt(formData.endPeriod));
                        const startTime = startPeriod ? startPeriod.startTime : '--:--';
                        const endTime = endPeriod ? endPeriod.endTime : '--:--';
                        return (
                          <div key={week} className="text-gray-600">
                            Woche {week + 1}: {date.toLocaleDateString('de-DE')} von {startTime} bis {endTime}
                          </div>
                        );
                      })}
                      {parseInt(formData.weeklyCount) > 10 && (
                        <div className="text-gray-500">... und {parseInt(formData.weeklyCount) - 10} weitere</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Lösch-Kontrolle */}
            <div className="pt-2 border-t">
              <label className="inline-flex items-center space-x-2">
                <input type="checkbox" checked={requireDeletionPassword} onChange={(e) => setRequireDeletionPassword(e.target.checked)} />
                <span className="text-sm text-gray-700">Passwort für Löschen verlangen</span>
              </label>
              {requireDeletionPassword && (
                <div className="mt-2">
                  <input
                    type="password"
                    value={deletionPassword}
                    onChange={(e) => setDeletionPassword(e.target.value)}
                    placeholder="Löschpasswort (standard: versteckt)"
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-md"
                  />
                  <p className="text-xs text-gray-500 mt-1">Wenn leer gelassen, wird Standardpasswort verwendet.</p>
                </div>
              )}
            </div>
            

            <div className="flex justify-between items-center pt-4 border-t border-gray-200 flex-wrap gap-3 text-sm">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
                >Löschen</button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors font-medium"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isSubmitting || conflicts.length > 0 || isCheckingConflicts}
                className={`px-6 py-2 rounded-md transition-colors font-medium ${
                  isSubmitting || conflicts.length > 0 || isCheckingConflicts
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
                }`}
              >
                {isSubmitting
                  ? 'Sende...'
                  : isCheckingConflicts 
                    ? 'Prüfe Konflikte...' 
                    : isEditing 
                      ? 'Änderungen speichern' 
                      : 'Reservierung erstellen'
                }
              </button>
            </div>
          </form>
        </div>
      </div>
      <PasswordModal
        open={passwordModal.open}
        title={passwordModal.purpose === 'edit' ? 'Passwort zum Bearbeiten' : 'Passwort'}
        message={passwordModal.purpose === 'edit' ? 'Bitte Passwort für diesen Termin eingeben.' : 'Bitte Passwort eingeben.'}
        onSubmit={handlePwdSubmit}
        onCancel={cancelPwdModal}
      />
      <DeleteScopeModal
        open={deleteModalOpen}
        hasSeries={!!seriesId}
        onCancel={() => setDeleteModalOpen(false)}
        onSelect={async (scope) => { setDeleteModalOpen(false); await performDelete(scope); }}
      />
    </>
  );
};

export default ReservationFormPage;
