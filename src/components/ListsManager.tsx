/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { AppConfig, MaintenanceCard } from "../types";
import TechnicalCardModal, { ProfileType } from "./TechnicalCardModal";
import { 
  Users, 
  Truck, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Search, 
  AlertCircle, 
  CheckCircle2,
  Wrench,
  UserCheck,
  Database,
  Download,
  Upload,
  FileText,
  Phone,
  Wifi,
  Share2,
  Copy,
  RefreshCw
} from "lucide-react";

interface ListsManagerProps {
  config: AppConfig;
  cards?: MaintenanceCard[];
  onNavigateToCard?: (cardId: string) => void;
  onSuccess: () => void;
  onOpenLanSettings?: () => void;
  lanConnected?: boolean;
  connectedClientsCount?: number;
  networkInfo?: { ip: string; port: number; localUrl: string; hostname?: string } | null;
  isPhoneMode?: boolean;
}

export default function ListsManager({ 
  config, 
  cards = [], 
  onNavigateToCard, 
  onSuccess,
  onOpenLanSettings,
  lanConnected = true,
  connectedClientsCount = 1,
  networkInfo = null,
  isPhoneMode = false
}: ListsManagerProps) {
  // Technical card modal state
  const [selectedProfile, setSelectedProfile] = useState<{ type: ProfileType; name: string } | null>(null);

  // Local list state
  const [workers, setWorkers] = useState<string[]>(config.default_workers || []);
  const [vehicles, setVehicles] = useState<string[]>(config.default_vehicles || []);
  const [drivers, setDrivers] = useState<string[]>(config.default_drivers || []);
  const [workerPhones, setWorkerPhones] = useState<Record<string, string>>(config.worker_phones || {});
  const [driverPhones, setDriverPhones] = useState<Record<string, string>>(config.driver_phones || {});
  const [mobileTab, setMobileTab] = useState<"workers" | "vehicles" | "drivers" | "backup" | "lan">("workers");

  // Search filter states
  const [workerSearch, setWorkerSearch] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [driverSearch, setDriverSearch] = useState("");

  // Input states for adding new elements
  const [newWorker, setNewWorker] = useState("");
  const [newWorkerPhone, setNewWorkerPhone] = useState("");
  const [newVehicle, setNewVehicle] = useState("");
  const [newDriver, setNewDriver] = useState("");
  const [newDriverPhone, setNewDriverPhone] = useState("");

  // Editing state trackers
  // Store the index being edited
  const [editingWorkerIndex, setEditingWorkerIndex] = useState<number | null>(null);
  const [editingWorkerValue, setEditingWorkerValue] = useState("");
  const [editingWorkerPhone, setEditingWorkerPhone] = useState("");

  const [editingVehicleIndex, setEditingVehicleIndex] = useState<number | null>(null);
  const [editingVehicleValue, setEditingVehicleValue] = useState("");

  const [editingDriverIndex, setEditingDriverIndex] = useState<number | null>(null);
  const [editingDriverValue, setEditingDriverValue] = useState("");
  const [editingDriverPhone, setEditingDriverPhone] = useState("");

  // Sync with remote config updates ONLY when the user is NOT actively typing or editing
  useEffect(() => {
    if (editingWorkerIndex === null && !newWorker && !newWorkerPhone) {
      setWorkers(config.default_workers || []);
      setWorkerPhones(config.worker_phones || {});
    }
  }, [config.default_workers, config.worker_phones, editingWorkerIndex, newWorker, newWorkerPhone]);

  useEffect(() => {
    if (editingVehicleIndex === null && !newVehicle) {
      setVehicles(config.default_vehicles || []);
    }
  }, [config.default_vehicles, editingVehicleIndex, newVehicle]);

  useEffect(() => {
    if (editingDriverIndex === null && !newDriver && !newDriverPhone) {
      setDrivers(config.default_drivers || []);
      setDriverPhones(config.driver_phones || {});
    }
  }, [config.default_drivers, config.driver_phones, editingDriverIndex, newDriver, newDriverPhone]);

  // Feedback alerts
  const [errorWord, setErrorWord] = useState("");
  const [successWord, setSuccessWord] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Backup and restore/import states
  const [isDragging, setIsDragging] = useState(false);
  const [backupFileParsed, setBackupFileParsed] = useState<any | null>(null);
  const [backupFileName, setBackupFileName] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [importError, setImportError] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // Confirmation state for custom modal dialogues replacing window.confirm or guarding updates
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  } | null>(null);

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  // Process and read uploaded JSON backup file
  const handleFileProcess = (file: File) => {
    setImportError("");
    setImportSuccess("");
    if (!file.name.endsWith(".json")) {
      setImportError("عذرًا، يجب اختيار ملف بنسق JSON فقط.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.cards)) {
          setImportError("الملف المرفق غير صالح كنسخة احتياطية (مصفوفة cards مفقودة).");
          return;
        }

        const cardsList = parsed.cards;
        const isValid = cardsList.length === 0 || cardsList.every((c: any) => c && typeof c === "object" && typeof c.id === "string" && typeof c.vehicle_id === "string");
        if (!isValid) {
          setImportError("محتوى الملف غير صالح: بنية بطاقات الصيانة الفنية غير صحيحة.");
          return;
        }

        setBackupFileParsed(parsed);
        setBackupFileName(file.name);
      } catch (err) {
        setImportError("فشل فك تشفير محتوى الملف بتنسيق JSON صالح.");
      }
    };
    reader.onerror = () => {
      setImportError("تعذر قراءة ملف النسخة الاحتياق من الجهاز الفني.");
    };
    reader.readAsText(file);
  };

  // Confirm and push the backup contents to the server
  const handleConfirmImport = async () => {
    if (!backupFileParsed) return;
    setIsImporting(true);
    setImportError("");
    setImportSuccess("");

    try {
      const response = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cards: backupFileParsed.cards,
          config: backupFileParsed.config
        })
      });

      const res = await response.json();
      if (response.ok && res.success) {
        setImportSuccess("تم بنجاح تفعيل النسخة الاحتياطية واسترجاع البيانات الفنية!");
        onSuccess();
        
        // Refresh local lists displays instantly
        if (backupFileParsed.config) {
          if (backupFileParsed.config.default_workers) {
            setWorkers(backupFileParsed.config.default_workers);
          }
          if (backupFileParsed.config.default_vehicles) {
            setVehicles(backupFileParsed.config.default_vehicles);
          }
          if (backupFileParsed.config.default_drivers) {
            setDrivers(backupFileParsed.config.default_drivers);
          }
        }

        setTimeout(() => {
          setBackupFileParsed(null);
          setBackupFileName("");
          setImportSuccess("");
        }, 2200);
      } else {
        setImportError(res.error || "فشل استيراد قاعدة البيانات.");
      }
    } catch (err) {
      console.error(err);
      setImportError("خطأ في الشبكة الخارجية: لم نتلقَ إجابة من خادم نظام الورشة الفني.");
    } finally {
      setIsImporting(false);
    }
  };

  // Trigger config save on the server
  const saveLists = async (
    updatedWorkers: string[],
    updatedVehicles: string[],
    updatedDrivers: string[],
    successMsg: string,
    updatedWorkerPhones?: Record<string, string>,
    updatedDriverPhones?: Record<string, string>
  ) => {
    setIsLoading(true);
    setErrorWord("");
    setSuccessWord("");

    const finalWorkerPhones = updatedWorkerPhones !== undefined ? updatedWorkerPhones : workerPhones;
    const finalDriverPhones = updatedDriverPhones !== undefined ? updatedDriverPhones : driverPhones;

    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_workers: updatedWorkers,
          default_vehicles: updatedVehicles,
          default_drivers: updatedDrivers,
          worker_phones: finalWorkerPhones,
          driver_phones: finalDriverPhones
        })
      });

      if (response.ok) {
        setSuccessWord(successMsg);
        onSuccess(); // Refresh state in parent App.tsx
        // Hide success message after 3 seconds
        setTimeout(() => setSuccessWord(""), 3500);
      } else {
        setErrorWord("فشل حفظ التعديلات على الخادم. يرجى التحقق من الاتصال.");
      }
    } catch (e) {
      console.error(e);
      setErrorWord("حدث خطأ أثناء حفظ القوائم.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Technicians Handlers ---
  const handleAddWorker = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newWorker.trim();
    const phone = newWorkerPhone.trim();
    if (!name) return;

    if (workers.includes(name)) {
      setErrorWord(`الفني "${name}" موجود بالفعل في القائمة.`);
      return;
    }

    const updated = [...workers, name];
    const updatedPhones = { ...workerPhones };
    if (phone) {
      updatedPhones[name] = phone;
    }
    setWorkers(updated);
    setWorkerPhones(updatedPhones);
    setNewWorker("");
    setNewWorkerPhone("");
    saveLists(updated, vehicles, drivers, `تمت إضافة الفني "${name}" بنجاح وتحديث القائمة.`, updatedPhones, driverPhones);
  };

  const handleDeleteWorker = (workerName: string) => {
    setConfirmState({
      isOpen: true,
      title: "تأكيد حذف فني",
      message: `هل أنت متأكد من رغبتك في حذف الفني "${workerName}" من قائمة الورشة المعتمدة؟ لن يظهر الاسم في الخيارات التلقائية بعد تاريخ الحذف.`,
      confirmText: "تأكيد حذف الفني",
      onConfirm: () => {
        const updated = workers.filter(w => w !== workerName);
        const updatedPhones = { ...workerPhones };
        delete updatedPhones[workerName];
        setWorkers(updated);
        setWorkerPhones(updatedPhones);
        saveLists(updated, vehicles, drivers, `تم حذف الفني "${workerName}" من القائمة بنجاح.`, updatedPhones, driverPhones);
        setConfirmState(null);
      }
    });
  };

  const handleStartEditWorker = (index: number, val: string) => {
    setEditingWorkerIndex(index);
    setEditingWorkerValue(val);
    setEditingWorkerPhone(workerPhones[val] || "");
  };

  const handleSaveEditWorker = (index: number) => {
    const val = editingWorkerValue.trim();
    const phone = editingWorkerPhone.trim();
    if (!val) return;

    // Check if duplicate
    const checkDuplicate = workers.some((w, idx) => w === val && idx !== index);
    if (checkDuplicate) {
      setErrorWord(`الاسم "${val}" مكرر لفني آخر.`);
      return;
    }

    const oldName = workers[index];
    const updated = [...workers];
    updated[index] = val;
    const updatedPhones = { ...workerPhones };
    if (oldName !== val) {
      delete updatedPhones[oldName];
    }
    if (phone) {
      updatedPhones[val] = phone;
    } else {
      delete updatedPhones[val];
    }

    setWorkers(updated);
    setWorkerPhones(updatedPhones);
    setEditingWorkerIndex(null);
    setEditingWorkerPhone("");
    saveLists(updated, vehicles, drivers, `تم تعديل بيانات الفني "${val}" بنجاح.`, updatedPhones, driverPhones);
  };

  // --- Vehicles Handlers ---
  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    const value = newVehicle.trim();
    if (!value) return;

    if (vehicles.includes(value)) {
      setErrorWord(`المركبة/الشاحنة "${value}" موجودة بالفعل في القائمة.`);
      return;
    }

    const updated = [...vehicles, value];
    setVehicles(updated);
    setNewVehicle("");
    saveLists(workers, updated, drivers, `تمت إضافة المركبة "${value}" بنجاح وتحديث قائمة الأسطول.`);
  };

  const handleDeleteVehicle = (vehicleName: string) => {
    setConfirmState({
      isOpen: true,
      title: "تأكيد حذف مركبة من الأسطول",
      message: `هل أنت متأكد من رغبتك في حذف المركبة/الشاحنة "${vehicleName}" من قائمة الأسطول النشطة؟`,
      confirmText: "تأكيد حذف المركبة",
      onConfirm: () => {
        const updated = vehicles.filter(v => v !== vehicleName);
        setVehicles(updated);
        saveLists(workers, updated, drivers, `تم حذف المركبة "${vehicleName}" بنجاح.`);
        setConfirmState(null);
      }
    });
  };

  const handleStartEditVehicle = (index: number, val: string) => {
    setEditingVehicleIndex(index);
    setEditingVehicleValue(val);
  };

  const handleSaveEditVehicle = (index: number) => {
    const val = editingVehicleValue.trim();
    if (!val) return;

    const checkDuplicate = vehicles.some((v, idx) => v === val && idx !== index);
    if (checkDuplicate) {
      setErrorWord(`اسم/رقم المركبة "${val}" موجود بالفعل.`);
      return;
    }

    const oldVal = vehicles[index];
    setConfirmState({
      isOpen: true,
      title: "تأكيد تحديث سجل الشاحنة",
      message: `هل أنت متأكد من رغبتك في تعديل رقم/اسم الشاحنة من "${oldVal}" إلى "${val}"؟`,
      confirmText: "تأكيد وحفظ الاسم الجديد",
      onConfirm: () => {
        const updated = [...vehicles];
        updated[index] = val;
        setVehicles(updated);
        setEditingVehicleIndex(null);
        saveLists(workers, updated, drivers, `تم تعديل المركبة من "${oldVal}" إلى "${val}".`);
        setConfirmState(null);
      }
    });
  };

  // --- Drivers Handlers ---
  const handleAddDriver = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newDriver.trim();
    const phone = newDriverPhone.trim();
    if (!name) return;

    if (drivers.includes(name)) {
      setErrorWord(`السائق "${name}" موجود بالفعل في القائمة.`);
      return;
    }

    const updated = [...drivers, name];
    const updatedPhones = { ...driverPhones };
    if (phone) {
      updatedPhones[name] = phone;
    }
    setDrivers(updated);
    setDriverPhones(updatedPhones);
    setNewDriver("");
    setNewDriverPhone("");
    saveLists(workers, vehicles, updated, `تمت إضافة السائق "${name}" بنجاح وتحديث قائمة السائقين.`, workerPhones, updatedPhones);
  };

  const handleDeleteDriver = (driverName: string) => {
    setConfirmState({
      isOpen: true,
      title: "تأكيد حذف سائق",
      message: `هل أنت متأكد من رغبتك في حذف السائق المعتمد "${driverName}" من قوائم النظام الفنية؟`,
      confirmText: "تأكيد حذف السائق",
      onConfirm: () => {
        const updated = drivers.filter(d => d !== driverName);
        const updatedPhones = { ...driverPhones };
        delete updatedPhones[driverName];
        setDrivers(updated);
        setDriverPhones(updatedPhones);
        saveLists(workers, vehicles, updated, `تم حذف السائق "${driverName}" من القائمة بنجاح.`, workerPhones, updatedPhones);
        setConfirmState(null);
      }
    });
  };

  const handleStartEditDriver = (index: number, val: string) => {
    setEditingDriverIndex(index);
    setEditingDriverValue(val);
    setEditingDriverPhone(driverPhones[val] || "");
  };

  const handleSaveEditDriver = (index: number) => {
    const val = editingDriverValue.trim();
    const phone = editingDriverPhone.trim();
    if (!val) return;

    const checkDuplicate = drivers.some((d, idx) => d === val && idx !== index);
    if (checkDuplicate) {
      setErrorWord(`الاسم "${val}" مكرر لسائق آخر.`);
      return;
    }

    const oldName = drivers[index];
    const updated = [...drivers];
    updated[index] = val;
    const updatedPhones = { ...driverPhones };
    if (oldName !== val) {
      delete updatedPhones[oldName];
    }
    if (phone) {
      updatedPhones[val] = phone;
    } else {
      delete updatedPhones[val];
    }

    setDrivers(updated);
    setDriverPhones(updatedPhones);
    setEditingDriverIndex(null);
    setEditingDriverPhone("");
    saveLists(workers, vehicles, updated, `تم تعديل بيانات السائق "${val}" بنجاح.`, workerPhones, updatedPhones);
  };

  // Filtered lists for search boxes (supports searching by name or phone)
  const filteredWorkers = workers.filter(w => 
    w.toLowerCase().includes(workerSearch.toLowerCase()) || 
    (workerPhones[w] && workerPhones[w].includes(workerSearch))
  );
  const filteredVehicles = vehicles.filter(v => v.toLowerCase().includes(vehicleSearch.toLowerCase()));
  const filteredDrivers = drivers.filter(d => 
    d.toLowerCase().includes(driverSearch.toLowerCase()) || 
    (driverPhones[d] && driverPhones[d].includes(driverSearch))
  );

  // Pre-calculate counts for workers, vehicles, and drivers
  const statsMap = useMemo(() => {
    const workerCounts = new Map<string, number>();
    const vehicleCounts = new Map<string, { cards: number; parts: number }>();
    const driverCounts = new Map<string, { cards: number; parts: number }>();

    cards.forEach(c => {
      // Vehicle
      const v = c.vehicle_id?.trim();
      if (v) {
        const item = vehicleCounts.get(v) || { cards: 0, parts: 0 };
        item.cards += 1;
        vehicleCounts.set(v, item);
      }

      // Driver
      const d = c.driver_name?.trim();
      if (d) {
        const item = driverCounts.get(d) || { cards: 0, parts: 0 };
        item.cards += 1;
        driverCounts.set(d, item);
      }

      // Worker from worker_name
      if (c.worker_name) {
        const wList = c.worker_name.split(/[،,\n\r]+/).map(w => w.trim()).filter(Boolean);
        wList.forEach(w => {
          workerCounts.set(w, (workerCounts.get(w) || 0) + 1);
        });
      }

      // Worker from repair_details JSON
      if (c.repair_details && c.repair_details.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(c.repair_details);
          if (Array.isArray(parsed)) {
            parsed.forEach((r: any) => {
              if (Array.isArray(r.workers)) {
                r.workers.forEach((w: string) => {
                  const trimmed = w?.trim();
                  if (trimmed) workerCounts.set(trimmed, (workerCounts.get(trimmed) || 0) + 1);
                });
              }
            });
          }
        } catch (e) {
          // ignore
        }
      }

      // Count parts
      if (c.parts && c.parts !== "[]" && c.parts.trim().length > 0) {
        let count = 0;
        if (c.parts.trim().startsWith("[")) {
          try {
            const parsed = JSON.parse(c.parts);
            if (Array.isArray(parsed)) {
              count = parsed.filter((p: any) => (p.name || p.description || "").trim().length > 0 && (p.name || p.description || "").trim() !== "[]").length;
            }
          } catch (e) {}
        } else {
          count = c.parts.split(/[\n\r]+/).filter((l: string) => l.trim().length > 0 && l.trim() !== "[]").length;
        }

        if (v && vehicleCounts.has(v)) {
          vehicleCounts.get(v)!.parts += count;
        }
        if (d && driverCounts.has(d)) {
          driverCounts.get(d)!.parts += count;
        }
      }
    });

    return { workerCounts, vehicleCounts, driverCounts };
  }, [cards]);

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>إدارة القوائم والمدخلات التلقائية</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">قم بإضافة وتعديل وحذف الفنيين والمركبات والسائقين لتحديث الخيارات التلقائية في نماذج الورشة</p>
        </div>
      </div>

      {/* Alert Messages */}
      {errorWord && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2.5 text-red-700 text-xs font-bold animate-pulse">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{errorWord}</span>
        </div>
      )}

      {successWord && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5 text-emerald-800 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{successWord}</span>
        </div>
      )}

      {/* Sub-Navigation Tabs for Mobile / Phone Mode */}
      <div className={`${isPhoneMode ? 'flex' : 'flex lg:hidden'} bg-slate-200/80 p-1.5 rounded-xl gap-1 overflow-x-auto scrollbar-none shadow-2xs`}>
        <button
          type="button"
          onClick={() => setMobileTab("workers")}
          className={`flex-1 min-w-[75px] py-2 px-2.5 rounded-lg text-xs font-black text-center transition cursor-pointer whitespace-nowrap ${
            mobileTab === "workers" ? "bg-white text-indigo-700 shadow-xs ring-1 ring-slate-300/60" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          الفنيون ({workers.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("vehicles")}
          className={`flex-1 min-w-[75px] py-2 px-2.5 rounded-lg text-xs font-black text-center transition cursor-pointer whitespace-nowrap ${
            mobileTab === "vehicles" ? "bg-white text-blue-700 shadow-xs ring-1 ring-slate-300/60" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          المركبات ({vehicles.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("drivers")}
          className={`flex-1 min-w-[75px] py-2 px-2.5 rounded-lg text-xs font-black text-center transition cursor-pointer whitespace-nowrap ${
            mobileTab === "drivers" ? "bg-white text-emerald-700 shadow-xs ring-1 ring-slate-300/60" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          السائقون ({drivers.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("backup")}
          className={`flex-1 min-w-[75px] py-2 px-2.5 rounded-lg text-xs font-black text-center transition cursor-pointer whitespace-nowrap ${
            mobileTab === "backup" ? "bg-white text-purple-700 shadow-xs ring-1 ring-slate-300/60" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          النسخ الاحتياطي
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("lan")}
          className={`flex-1 min-w-[85px] py-2 px-2.5 rounded-lg text-xs font-black text-center transition cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
            mobileTab === "lan" ? "bg-white text-blue-700 shadow-xs ring-1 ring-slate-300/60" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Wifi className="w-3.5 h-3.5 text-blue-600" />
          <span>الشبكة ({connectedClientsCount})</span>
        </button>
      </div>

      {/* Grid of 3 Lists */}
      <div className={`grid grid-cols-1 ${isPhoneMode ? 'grid-cols-1 gap-4' : 'lg:grid-cols-3 gap-6'}`}>
        
        {/* Panel 1: Technicians List */}
        <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-2xs ${
          isPhoneMode
            ? (mobileTab === 'workers' ? 'flex' : 'hidden')
            : (mobileTab === 'workers' ? 'flex' : 'hidden lg:flex')
        }`}>
          <div className="p-4 bg-indigo-50/50 border-b border-slate-150 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs.5 font-bold text-slate-850">قائمة الفنيين والعمال ({workers.length})</h3>
            </div>
            <span className="text-[10px] bg-indigo-100 text-indigo-700 font-extrabold px-2 py-0.5 rounded-full">جاهز للتعيين</span>
          </div>

          {/* Add Technician Form */}
          <form onSubmit={handleAddWorker} className="p-3.5 border-b border-slate-100 bg-slate-50/50 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                required
                disabled={isLoading}
                value={newWorker}
                onChange={(e) => setNewWorker(e.target.value)}
                placeholder="اسم الفني (مثال: ميكانيكي م. مصطفى)..."
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800 flex-1 leading-relaxed"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة فني</span>
              </button>
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus-within:border-indigo-500">
              <Phone className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <input
                type="tel"
                disabled={isLoading}
                value={newWorkerPhone}
                onChange={(e) => setNewWorkerPhone(e.target.value)}
                placeholder="رقم هاتف الفني (اختياري، مثال: 0655123456)..."
                className="text-xs w-full bg-transparent focus:outline-none text-slate-800 font-medium"
                dir="ltr"
              />
            </div>
          </form>

          {/* Search Box */}
          <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2 text-slate-400 bg-white">
            <Search className="w-3.5 h-3.5" />
            <input
              type="text"
              value={workerSearch}
              onChange={(e) => setWorkerSearch(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الهاتف..."
              className="text-xs bg-transparent focus:outline-none w-full font-medium text-slate-700"
            />
            {workerSearch && (
              <button type="button" onClick={() => setWorkerSearch("")} className="text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto bg-white">
            {filteredWorkers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                لا يوجد فنيين مطابقين للبحث. يمكنك إضافة فني جديد في الأعلى.
              </div>
            ) : (
              filteredWorkers.map((worker) => {
                const originalIndex = workers.indexOf(worker);
                const isEditing = editingWorkerIndex === originalIndex;

                return (
                  <div key={worker} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition">
                    {isEditing ? (
                      <div className="flex flex-col gap-2 w-full bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-200">
                        <input
                          type="text"
                          required
                          value={editingWorkerValue}
                          onChange={(e) => setEditingWorkerValue(e.target.value)}
                          placeholder="اسم الفني..."
                          className="px-2.5 py-1.5 border border-indigo-300 rounded text-xs.5 font-bold focus:outline-none text-slate-800 bg-white"
                        />
                        <div className="flex items-center gap-1.5 bg-white border border-indigo-200 rounded px-2.5 py-1">
                          <Phone className="w-3 h-3 text-indigo-500 shrink-0" />
                          <input
                            type="tel"
                            value={editingWorkerPhone}
                            onChange={(e) => setEditingWorkerPhone(e.target.value)}
                            placeholder="رقم الهاتف (اختياري)..."
                            className="text-xs w-full bg-transparent focus:outline-none text-slate-800 font-medium"
                            dir="ltr"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleSaveEditWorker(originalIndex)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded flex items-center gap-1 shadow-2xs cursor-pointer"
                            title="حفظ التعديل"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>حفظ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingWorkerIndex(null)}
                            className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded flex items-center gap-1 cursor-pointer"
                            title="إلغاء الأمر"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>إلغاء</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div 
                          onClick={() => setSelectedProfile({ type: "worker", name: worker })}
                          className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                          title="انقر لفتح البطاقة الفنية الشاملة للفني"
                        >
                          <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs.5 font-bold text-slate-700 hover:text-indigo-600 truncate transition">
                              {worker}
                            </span>
                            {workerPhones[worker] ? (
                              <a
                                href={`tel:${workerPhones[worker]}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10.5px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-mono tracking-wider w-fit"
                                dir="ltr"
                                title="انقر للاتصال الهاتفي"
                              >
                                <Phone className="w-2.5 h-2.5 text-indigo-500" />
                                <span>{workerPhones[worker]}</span>
                              </a>
                            ) : null}
                          </div>
                          {statsMap.workerCounts.get(worker) ? (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-medium shrink-0 border border-indigo-100 mr-auto">
                              {statsMap.workerCounts.get(worker)} صيانة
                            </span>
                          ) : null}
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedProfile({ type: "worker", name: worker })}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 text-[11px] font-bold rounded-lg border border-indigo-100 transition cursor-pointer shadow-2xs"
                            title="عرض البطاقة الفنية للفني وسجل أعماله"
                          >
                            <FileText className="w-3 h-3" />
                            <span className="hidden sm:inline">البطاقة الفنية</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditWorker(originalIndex, worker)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                            title="تعديل هذا الفني"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWorker(worker)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="حذف هذا الفني"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Panel 2: Vehicles List */}
        <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-2xs ${
          isPhoneMode
            ? (mobileTab === 'vehicles' ? 'flex' : 'hidden')
            : (mobileTab === 'vehicles' ? 'flex' : 'hidden lg:flex')
        }`}>
          <div className="p-4 bg-slate-50 border-b border-slate-150 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs.5 font-bold text-slate-850">قائمة المركبات والأسطول ({vehicles.length})</h3>
            </div>
            <span className="text-[10px] bg-blue-100 text-blue-700 font-extrabold px-2 py-0.5 rounded-full">مسجل بالنظام</span>
          </div>

          {/* Add Vehicle Form */}
          <form onSubmit={handleAddVehicle} className="p-4 border-b border-slate-100 bg-slate-50/50 flex gap-2">
            <input
              type="text"
              required
              disabled={isLoading}
              value={newVehicle}
              onChange={(e) => setNewVehicle(e.target.value)}
              placeholder="مثال: شاحنة MAN - 18.440..."
              className="px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 flex-1 leading-relaxed"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مركبة</span>
            </button>
          </form>

          {/* Search Box */}
          <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2 text-slate-400 bg-white">
            <Search className="w-3.5 h-3.5" />
            <input
              type="text"
              value={vehicleSearch}
              onChange={(e) => setVehicleSearch(e.target.value)}
              placeholder="ابحث عن مركبة/شاحنة..."
              className="text-xs bg-transparent focus:outline-none w-full font-medium text-slate-700"
            />
            {vehicleSearch && (
              <button type="button" onClick={() => setVehicleSearch("")} className="text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto bg-white">
            {filteredVehicles.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                لا يوجد شاحنات مركبات مطابقة في قاعدة البحث حالياً.
              </div>
            ) : (
              filteredVehicles.map((vehicle) => {
                const originalIndex = vehicles.indexOf(vehicle);
                const isEditing = editingVehicleIndex === originalIndex;

                return (
                  <div key={vehicle} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition">
                    {isEditing ? (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="text"
                          required
                          value={editingVehicleValue}
                          onChange={(e) => setEditingVehicleValue(e.target.value)}
                          className="px-2 py-1.5 border border-blue-300 rounded text-xs.5 font-bold focus:outline-none text-slate-800 flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEditVehicle(originalIndex)}
                          className="bg-emerald-550 hover:bg-emerald-600 p-1.5 text-white rounded transition"
                          title="حفظ التعديل"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingVehicleIndex(null)}
                          className="bg-slate-200 hover:bg-slate-300 p-1.5 text-slate-600 rounded transition"
                          title="إلغاء الأمر"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div 
                          onClick={() => setSelectedProfile({ type: "vehicle", name: vehicle })}
                          className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                          title="انقر لفتح البطاقة الفنية الشاملة للمركبة وسجل قطع الغيار"
                        >
                          <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                          <span className="text-xs.5 font-bold text-slate-700 hover:text-blue-600 truncate transition font-mono">
                            {vehicle}
                          </span>
                          {statsMap.vehicleCounts.get(vehicle) ? (
                            <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-medium shrink-0 border border-blue-100">
                              {statsMap.vehicleCounts.get(vehicle)?.cards} بطاقة • {statsMap.vehicleCounts.get(vehicle)?.parts} قطع
                            </span>
                          ) : null}
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedProfile({ type: "vehicle", name: vehicle })}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 text-[11px] font-bold rounded-lg border border-blue-100 transition cursor-pointer shadow-2xs"
                            title="عرض البطاقة الفنية للمركبة وسجل قطع الغيار والدخول والخروج"
                          >
                            <FileText className="w-3 h-3" />
                            <span className="hidden sm:inline">البطاقة الفنية</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditVehicle(originalIndex, vehicle)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                            title="تعديل هذه المركبة"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVehicle(vehicle)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="حذف هذه المركبة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Panel 3: Drivers List */}
        <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col shadow-2xs ${
          isPhoneMode
            ? (mobileTab === 'drivers' ? 'flex' : 'hidden')
            : (mobileTab === 'drivers' ? 'flex' : 'hidden lg:flex')
        }`}>
          <div className="p-4 bg-emerald-50 border-b border-slate-150 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs.5 font-bold text-slate-850">قائمة السائقين المعتمدين ({drivers.length})</h3>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-700 font-extrabold px-2 py-0.5 rounded-full">سائق معتمد</span>
          </div>

          {/* Add Driver Form */}
          <form onSubmit={handleAddDriver} className="p-3.5 border-b border-slate-100 bg-emerald-50/50 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                required
                disabled={isLoading}
                value={newDriver}
                onChange={(e) => setNewDriver(e.target.value)}
                placeholder="اسم السائق (مثال: سليمان الدوسري)..."
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 text-slate-800 flex-1 leading-relaxed"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة سائق</span>
              </button>
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus-within:border-emerald-500">
              <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <input
                type="tel"
                disabled={isLoading}
                value={newDriverPhone}
                onChange={(e) => setNewDriverPhone(e.target.value)}
                placeholder="رقم هاتف السائق (اختياري، مثال: 0655123456)..."
                className="text-xs w-full bg-transparent focus:outline-none text-slate-800 font-medium"
                dir="ltr"
              />
            </div>
          </form>

          {/* Search Box */}
          <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2 text-slate-400 bg-white">
            <Search className="w-3.5 h-3.5" />
            <input
              type="text"
              value={driverSearch}
              onChange={(e) => setDriverSearch(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الهاتف..."
              className="text-xs bg-transparent focus:outline-none w-full font-medium text-slate-700"
            />
            {driverSearch && (
              <button type="button" onClick={() => setDriverSearch("")} className="text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto bg-white">
            {filteredDrivers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                لا يوجد سائقين مطابقين لنتائج البحث حالياً. يمكنك إضافة سائق جديد في الأعلى.
              </div>
            ) : (
              filteredDrivers.map((driver) => {
                const originalIndex = drivers.indexOf(driver);
                const isEditing = editingDriverIndex === originalIndex;

                return (
                  <div key={driver} className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition">
                    {isEditing ? (
                      <div className="flex flex-col gap-2 w-full bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-200">
                        <input
                          type="text"
                          required
                          value={editingDriverValue}
                          onChange={(e) => setEditingDriverValue(e.target.value)}
                          placeholder="اسم السائق..."
                          className="px-2.5 py-1.5 border border-emerald-300 rounded text-xs.5 font-bold focus:outline-none text-slate-800 bg-white"
                        />
                        <div className="flex items-center gap-1.5 bg-white border border-emerald-200 rounded px-2.5 py-1">
                          <Phone className="w-3 h-3 text-emerald-500 shrink-0" />
                          <input
                            type="tel"
                            value={editingDriverPhone}
                            onChange={(e) => setEditingDriverPhone(e.target.value)}
                            placeholder="رقم الهاتف (اختياري)..."
                            className="text-xs w-full bg-transparent focus:outline-none text-slate-800 font-medium"
                            dir="ltr"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleSaveEditDriver(originalIndex)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded flex items-center gap-1 shadow-2xs cursor-pointer"
                            title="حفظ التعديل"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>حفظ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDriverIndex(null)}
                            className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded flex items-center gap-1 cursor-pointer"
                            title="إلغاء الأمر"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>إلغاء</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div 
                          onClick={() => setSelectedProfile({ type: "driver", name: driver })}
                          className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                          title="انقر لفتح البطاقة الفنية للسائق وقائمة قطع الغيار المستبدلة أثناء سياقته"
                        >
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs.5 font-bold text-slate-700 hover:text-emerald-700 truncate transition">
                              {driver}
                            </span>
                            {driverPhones[driver] ? (
                              <a
                                href={`tel:${driverPhones[driver]}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[10.5px] text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-mono tracking-wider w-fit"
                                dir="ltr"
                                title="انقر للاتصال الهاتفي"
                              >
                                <Phone className="w-2.5 h-2.5 text-emerald-500" />
                                <span>{driverPhones[driver]}</span>
                              </a>
                            ) : null}
                          </div>
                          {statsMap.driverCounts.get(driver) ? (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-medium shrink-0 border border-emerald-100 mr-auto">
                              {statsMap.driverCounts.get(driver)?.cards} دخول • {statsMap.driverCounts.get(driver)?.parts} قطع
                            </span>
                          ) : null}
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedProfile({ type: "driver", name: driver })}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 text-[11px] font-bold rounded-lg border border-emerald-100 transition cursor-pointer shadow-2xs"
                            title="عرض البطاقة الفنية وقائمة قطع الغيار المستبدلة أثناء سياقته وأي مركبة"
                          >
                            <FileText className="w-3 h-3" />
                            <span className="hidden sm:inline">البطاقة الفنية</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditDriver(originalIndex, driver)}
                            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition cursor-pointer"
                            title="تعديل هذا السائق"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDriver(driver)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="حذف هذا السائق"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Backup & DB administration card layout */}
      <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs mt-8 ${
        isPhoneMode
          ? (mobileTab === 'backup' ? 'block' : 'hidden')
          : (mobileTab === 'backup' ? 'block' : 'hidden lg:block')
      }`}>
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/75">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <h3 className="text-xs.5 sm:text-sm font-black text-slate-800">صيانة قاعدة البيانات والأرشفة الخارجية</h3>
          </div>
          <span className="text-[9.5px] bg-indigo-50 border border-indigo-200 text-indigo-750 px-2.5 py-1 rounded font-extrabold shadow-3xs uppercase tracking-wide">
            أدوات مسؤول النظام الفني
          </span>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Export block */}
            <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-200/65 flex flex-col justify-between space-y-4">
              <div className="space-y-2 text-right">
                <h4 className="text-xs.5 font-bold text-slate-800 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-blue-600" />
                  <span>تصدير نسخة احتياطية كاملة (.json)</span>
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  قم بتحميل ملف متكامل يحتوي على كافة سجلات وبطاقات صيانة شاحنات الورشة المسجلة، بالإضافة للخيارات التلقائية والأسماء المعتمدة. يمكنك استخدام هذا السجل كمرجع خارجي للرجوع إليه أو ترحيله بأمان.
                </p>
              </div>
              
              <div className="pt-4 border-t border-slate-200/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-[10px] font-extrabold text-slate-400 font-mono tracking-wide">الملف المخرّج: JSON Database Backups</span>
                <button
                  type="button"
                  onClick={() => { window.location.href = "/api/backup/export"; }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition leading-snug cursor-pointer shadow-3xs hover:-translate-y-[1px] duration-150"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل ملف النسخة الاحتياطية</span>
                </button>
              </div>
            </div>

            {/* Import block */}
            <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-200/65 flex flex-col space-y-4 text-right">
              <div className="space-y-1.5">
                <h4 className="text-xs.5 font-bold text-slate-800 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-violet-600" />
                  <span>استيراد واستعادة قاعدة البيانات</span>
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                  اختر أو اسحب ملفًا مُصدّرًا مسبقًا لاستعادة السلسلة الكاملة من البيانات. <span className="text-rose-600 font-extrabold">تنبيه حاسم:</span> ستعمل هذه الخطوة على استبدال قاعدة البيانات الفنية النشطة حالياً لموقع الورشة بالكامل.
                </p>
              </div>

              {/* Drag drop zone container */}
              {!backupFileParsed ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("db_backup_file_picker")?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-155 ${
                    isDragging
                      ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                      : "border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400"
                  }`}
                >
                  <input
                    type="file"
                    id="db_backup_file_picker"
                    accept=".json"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                  <Upload className={`w-8 h-8 mb-2 transition ${isDragging ? "text-indigo-600 animate-bounce" : "text-slate-400"}`} />
                  <p className="text-xs font-bold text-slate-700 mb-1">
                    اسحب وأسقط ملف النسخة الاحتياطية (JSON) هنا
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold">
                    أو انقر لتصفح الملفات من جهازك الفني
                  </p>
                </div>
              ) : (
                /* Pending file upload card */
                <div className="bg-white border border-amber-250 rounded-xl p-4 space-y-3.5 shadow-3xs text-right">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 max-w-[85%]">
                      <span className="bg-amber-50 text-amber-800 border border-amber-200 rounded text-[9px] font-extrabold px-2 py-0.5 inline-block mb-1">
                        تم التحقق وجاهز للاستعادة
                      </span>
                      <p className="text-xs font-black text-slate-800 break-all leading-normal">
                        <span className="text-slate-400 font-bold">الملف:</span> {backupFileName}
                      </p>
                      <div className="text-[10px] font-extrabold text-slate-500 space-y-1 pt-1 opacity-95">
                        <p>• بطاقات الصيانة: <span className="font-black text-rose-600 font-mono text-xs">{backupFileParsed.cards?.length || 0} سجل</span></p>
                        <p>• الفنيين المضمنين: <span className="font-extrabold text-indigo-600 font-mono text-xs">{backupFileParsed.config?.default_workers?.length || 0}</span></p>
                        <p>• طواقم العمل: <span className="font-extrabold text-indigo-600 font-mono text-xs">{backupFileParsed.config?.default_work_teams?.length || 0}</span></p>
                        {backupFileParsed.timestamp && (
                          <p>• تاريخ النسخة: {new Date(backupFileParsed.timestamp).toLocaleString("ar-SA")}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setBackupFileParsed(null);
                        setBackupFileName("");
                      }}
                      className="text-slate-400 hover:bg-slate-100 p-1.5 rounded-md cursor-pointer transition hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Confirmation panel */}
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={isImporting}
                      onClick={handleConfirmImport}
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs py-2 rounded-lg transition disabled:opacity-50 cursor-pointer shadow-3xs text-center"
                    >
                      {isImporting ? "جاري الاسترجاع الفني وصيانة الجداول..." : "تأكيد واستبدال قاعدة البيانات الفنية"}
                    </button>
                    <button
                      type="button"
                      disabled={isImporting}
                      onClick={() => {
                        setBackupFileParsed(null);
                        setBackupFileName("");
                      }}
                      className="px-4.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs py-2 rounded-lg transition cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}

              {/* Success and Error Indicators */}
              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}
              {importSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800 font-extrabold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{importSuccess}</span>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* LAN & Multi-Device Network Connectivity Section at bottom of Lists & Fleet Management page */}
      <div className={`bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden mt-6 text-right ${
        isPhoneMode
          ? (mobileTab === 'lan' ? 'block' : 'hidden')
          : (mobileTab === 'lan' ? 'block' : 'hidden lg:block')
      }`} id="lan-network-management-section">
        <div className="border-b border-slate-100 px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white">
                ربط وإدارة أجهزة الشبكة المحلية (LAN) والمزامنة الفورية
              </h3>
              <p className="text-[11px] text-slate-300">
                مشاركة النظام والعمل الجماعي من عدة أجهزة كمبيوتر وشاشات في نفس الوقت
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
              lanConnected
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-rose-500/20 text-rose-300 border-rose-500/40"
            }`}>
              <span className={`w-2 h-2 rounded-full ${lanConnected ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`}></span>
              <span>{lanConnected ? `متصل (${connectedClientsCount} أجهزة)` : "غير متصل"}</span>
            </span>

            {onOpenLanSettings && (
              <button
                type="button"
                onClick={onOpenLanSettings}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>نافذة المشاركة</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4 bg-slate-50/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">حالة المزامنة الحية (SSE)</span>
                <span className={`w-2.5 h-2.5 rounded-full ${lanConnected ? "bg-emerald-500" : "bg-rose-500"}`}></span>
              </div>
              <p className="text-lg font-black text-slate-900">
                {lanConnected ? "قيد التشغيل الفوري" : "متوقف مؤقتاً"}
              </p>
              <p className="text-[11px] text-slate-500">
                يتم تحديث وإرسال أي تغيير بالبطاقات لباقي الأجهزة في أقل من ثانية.
              </p>
            </div>

            {/* Clients count card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-500 block">الأجهزة المتصلة بالشبكة</span>
              <p className="text-lg font-black text-blue-700 font-mono">
                {connectedClientsCount} <span className="text-xs font-bold text-slate-600">أجهزة متزامنة</span>
              </p>
              <p className="text-[11px] text-slate-500">
                كافة الشاشات وأجهزة الحاسوب العاملة حالياً على نفس النظام.
              </p>
            </div>

            {/* Safety protection card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-500 block">حماية قاعدة البيانات</span>
              <p className="text-lg font-black text-emerald-700">
                كتابة ذرية مؤمنة
              </p>
              <p className="text-[11px] text-slate-500">
                منع تضارب البيانات أو تكرار إدخال نفس المركبة في نفس اللحظة.
              </p>
            </div>
          </div>

          {/* Direct link input */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              رابط تشغيل التطبيق من باقي أجهزة الكمبيوتر في الورشة:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                dir="ltr"
                value={networkInfo ? networkInfo.localUrl : window.location.origin}
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-sm font-bold text-blue-700 select-all"
              />
              <button
                type="button"
                onClick={() => {
                  const url = networkInfo ? networkInfo.localUrl : window.location.origin;
                  navigator.clipboard?.writeText(url);
                  if (onOpenLanSettings) onOpenLanSettings();
                }}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 text-xs shadow-xs"
                title="نسخ الرابط لمشاركته"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ الرابط</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              💡 قم بنسخ هذا الرابط وافتحه في المتصفح (Google Chrome أو Microsoft Edge) على أي جهاز كمبيوتر متصل بنفس الراوتر أو شبكة الورشة.
            </p>
          </div>
        </div>
      </div>

      {/* Beautiful Modal-driven Confirmation Dialog */}
      {confirmState && confirmState.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn" style={{ direction: 'rtl' }}>
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 relative overflow-hidden text-right">
            {/* Decorative top strip */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 to-blue-500"></div>

            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 shrink-0">
                <AlertCircle className="w-6 h-6 animate-pulse" />
              </div>
              
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-black text-slate-900">
                  {confirmState.title}
                </h3>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  {confirmState.message}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 pt-4 border-t border-slate-100 mt-5">
              <button
                type="button"
                onClick={confirmState.onConfirm}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2.5 rounded-lg transition duration-155 cursor-pointer text-center"
              >
                {confirmState.confirmText || "نعم، تأكيد الإجراء"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-755 font-bold text-xs py-2.5 rounded-lg transition duration-155 cursor-pointer text-center"
              >
                {confirmState.cancelText || "تراجع"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Technical Profile Card Modal */}
      {selectedProfile && (
        <TechnicalCardModal
          type={selectedProfile.type}
          targetName={selectedProfile.name}
          cards={cards}
          driverPhones={driverPhones}
          workerPhones={workerPhones}
          onClose={() => setSelectedProfile(null)}
          onOpenProfile={(type, name) => setSelectedProfile({ type, name })}
          onOpenCard={(cardId) => {
            if (onNavigateToCard) {
              onNavigateToCard(cardId);
            }
          }}
        />
      )}

    </div>
  );
}
