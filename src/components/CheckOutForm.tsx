/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { MaintenanceCard } from "../types";
import { LogOut, Calendar, Signature, CheckCircle, AlertTriangle, User, FileText } from "lucide-react";

interface CheckOutFormProps {
  cards: MaintenanceCard[];
  onSuccess: () => void;
}

export default function CheckOutForm({ cards, onSuccess }: CheckOutFormProps) {
  const [selectedCardId, setSelectedCardId] = useState("");
  const [dateOut, setDateOut] = useState("");
  const [sigMechanic, setSigMechanic] = useState("");
  const [sigElectrician, setSigElectrician] = useState("");
  const [sigManager, setSigManager] = useState("");
  
  const [successWord, setSuccessWord] = useState("");
  const [errorWord, setErrorWord] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Filter cards that are currently in check_in or maintenance status
  const activeCards = cards.filter(c => c.status === "check_in" || c.status === "maintenance");

  // Track loaded card and user dirty state to prevent background SSE/polling from wiping active typing
  const loadedCardIdRef = React.useRef<string>("");
  const isDirtyRef = React.useRef<boolean>(false);

  // Load selected card info only when changing to a DIFFERENT card ID
  useEffect(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISO = new Date(now.getTime() - offset).toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
    if (!dateOut) {
      setDateOut(localISO);
    }

    if (!selectedCardId) {
      loadedCardIdRef.current = "";
      isDirtyRef.current = false;
      setSigMechanic("");
      setSigElectrician("");
      setSigManager("");
      return;
    }

    // Only load from card when switching card ID
    if (selectedCardId !== loadedCardIdRef.current) {
      loadedCardIdRef.current = selectedCardId;
      isDirtyRef.current = false;
      const card = cards.find(c => c.id === selectedCardId);
      if (card) {
        setSigMechanic(card.signature_mechanic || "");
        setSigElectrician(card.signature_electrician || "");
        setSigManager(card.signature_manager || "المهندس المناوب");
        setErrorWord("");
        setSuccessWord("");
      }
    }
  }, [selectedCardId]);

  const handleCheckOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardId) {
      setErrorWord("يرجى اختيار بطاقة صيانة أولاً");
      return;
    }

    setIsLoading(true);
    setErrorWord("");
    setSuccessWord("");

    try {
      const response = await fetch(`/api/cards/${selectedCardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date_out: dateOut,
          signature_mechanic: "",
          signature_electrician: "",
          signature_manager: sigManager.trim(),
          status: "completed" // Finalize maintenance card
        }),
      });

      const res = await response.json();
      if (response.ok) {
        setSuccessWord(`تم تسجيل خروج المركبة بنجاح وإغلاق بطاقة الصيانة الفنية! نقلت تلقائياً للأرشيف.`);
        setSelectedCardId("");
        isDirtyRef.current = false;
        loadedCardIdRef.current = "";
        onSuccess();
      } else {
        setErrorWord(res.error || "فشل تسجيل الخروج");
      }
    } catch (err) {
      setErrorWord("حدث خطأ في الاتصال بالخادم");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200" id="checkout-panel">
      <div className="border-b border-slate-100 px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-3 bg-slate-50/50">
        <div className="bg-emerald-50 p-2 sm:p-2.5 rounded-xl text-emerald-600 shrink-0">
          <LogOut className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-slate-900">تسجيل خروج المركبة وإغلاق البطاقة</h2>
          <p className="text-[10px] sm:text-xs text-slate-400">مراجعة نهائية، توثيق تاريخ الخروج، واعتماد تواقيع الطواقم</p>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {activeCards.length === 0 ? (
          <div className="text-center py-10 space-y-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="text-slate-700 font-bold">لا توجد شاحنات أو مركبات تحتاج خروج حالياً</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto px-4">
              يمكنك التحقق من "تسجيل الدخول" أو إكمال تعبئة تشخيص وعمل صيانة لمركبات الانتظار في تبويب "الصيانة" أولاً.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Selector */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                اختر بطاقة صيانة المركبة الجاهزة للمغادرة:
              </label>
              <select
                id="select_card_checkout"
                value={selectedCardId}
                onChange={(e) => {
                  setSelectedCardId(e.target.value);
                  isDirtyRef.current = false;
                }}
                className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 bg-white border border-black rounded-lg focus:border-black focus:outline-none transition-all text-slate-900 font-medium text-xs sm:text-sm"
              >
                <option value="">-- اضغط هنا للاختيار لتسجيل خروجها --</option>
                {activeCards.map((c) => {
                  const locTag = c.destination === "parking" ? "[موقف المركبات]" : "[الورشة]";
                  return (
                    <option key={c.id} value={c.id}>
                      {c.id} - شاحنة: {c.vehicle_id} (سائق: {c.driver_name}) {locTag} | {c.diagnosis ? "مكتملة الفحص والقطع" : "لم يفحصها الميكانيكي بعد"}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedCardId && (
              <form onSubmit={handleCheckOut} className="space-y-6 pt-5 border-t border-slate-100">
                {errorWord && (
                  <div className="bg-rose-50 border-r-4 border-rose-500 text-rose-800 p-3 sm:p-4 rounded-xl text-xs font-bold">
                    {errorWord}
                  </div>
                )}

                {successWord && (
                  <div className="bg-emerald-50 border-r-4 border-emerald-500 text-emerald-800 p-3 sm:p-4 rounded-xl text-xs font-bold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{successWord}</span>
                  </div>
                )}

                {/* Display simple card metadata preview */}
                <div className="bg-slate-50/70 border border-slate-200 p-3.5 sm:p-5 rounded-xl space-y-3">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">ملخص الأعمال المنفذة والمتبقية للمراجعة الفنية</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="sm:col-span-1">
                      <span className="font-bold block text-slate-500 mb-1">قطع الغيار المستبدلة:</span>
                      <div className="bg-white p-2.5 border border-slate-100 rounded-lg text-slate-800 font-medium text-xs min-h-[3.5rem] max-h-48 overflow-y-auto">
                        {(() => {
                          const partsText = cards.find(c => c.id === selectedCardId)?.parts || "";
                          if (!partsText || partsText.trim() === "[]" || partsText.trim() === "") return <span className="text-slate-400">لم يتم تسجيل تركيب قطع غيار</span>;
                          try {
                            if (partsText.trim().startsWith("[")) {
                              const parsed = JSON.parse(partsText);
                              if (Array.isArray(parsed)) {
                                const valid = parsed.filter((item: any) => (item.name || item.description || "").trim().length > 0 && (item.name || item.description || "").trim() !== "[]");
                                if (valid.length > 0) {
                                  return (
                                    <ul className="space-y-1.5 text-right list-disc pr-4 text-xs font-bold text-slate-900">
                                      {valid.map((item: any, idx: number) => (
                                        <li key={idx}>
                                          <span>{item.name || item.description}</span>
                                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black mr-1.5 ${
                                            item.target === "trailer"
                                              ? "bg-amber-100 text-amber-800"
                                              : "bg-blue-100 text-blue-800"
                                          }`}>
                                            {item.target === "trailer" ? "المقطورة" : "المركبة"}
                                          </span>
                                          {item.date && (
                                            <span className="text-[10px] text-slate-400 font-normal mr-1.5 font-mono">
                                              ({item.date})
                                            </span>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  );
                                }
                                return <span className="text-slate-400">لم يتم تسجيل تركيب قطع غيار</span>;
                              }
                            }
                          } catch (e) {
                            // ignore
                          }
                          if (partsText.trim() === "[]") return <span className="text-slate-400">لم يتم تسجيل تركيب قطع غيار</span>;
                          return <div className="whitespace-pre-wrap font-medium">{partsText}</div>;
                        })()}
                      </div>
                    </div>
                    <div className="sm:col-span-1">
                      <span className="font-bold block text-slate-500 mb-1">أعمال إصلاح العطب والمنفذين:</span>
                      <div className="bg-white p-2.5 border border-slate-100 rounded-lg text-slate-800 font-medium text-xs min-h-[4rem] space-y-2 max-h-48 overflow-y-auto">
                        {(() => {
                          const repairText = cards.find(c => c.id === selectedCardId)?.repair_details || "";
                          let isJson = false;
                          let parsedRepairs: any[] = [];
                          try {
                            if (repairText.trim().startsWith("[")) {
                              const parsed = JSON.parse(repairText);
                              if (Array.isArray(parsed)) {
                                parsedRepairs = parsed;
                                isJson = true;
                              }
                            }
                          } catch (e) {
                            // ignore
                          }

                          if (isJson) {
                            return (
                              <div className="space-y-2">
                                {parsedRepairs.map((rep: any, idx: number) => (
                                  <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 space-y-1.5">
                                    <div className="text-slate-800 font-bold text-xs.5 leading-relaxed">
                                      <span className="text-blue-600 font-black">عطب {idx + 1}:</span> {rep.description || rep.action || "—"}
                                    </div>
                                    {rep.workers && Array.isArray(rep.workers) && rep.workers.length > 0 && (
                                      <div className="flex flex-wrap gap-1 items-center pt-1.5 border-t border-dashed border-slate-200">
                                        <span className="text-slate-500 text-[8.5px] font-bold">الفنيين المنفذين:</span>
                                        {rep.workers.map((w: string, widx: number) => (
                                          <span key={widx} className="bg-yellow-50 text-yellow-900 border border-yellow-250 px-1.5 py-0.5 rounded text-[9.5px] font-black shadow-3xs">
                                            {w}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          } else {
                            return (
                              <p className="whitespace-pre-line leading-relaxed">
                                {repairText || "لا توجد تفاصيل أعمال صيانة"}
                              </p>
                            );
                          }
                        })()}
                      </div>
                    </div>
                    <div className="sm:col-span-1 space-y-3">
                      <div>
                        <span className="font-bold block text-slate-500 mb-1">الفنيين المنفذين (إجمالاً):</span>
                        <div className="bg-amber-50/50 p-2 border border-amber-200 rounded-lg text-slate-800 font-bold text-xs flex flex-wrap gap-1">
                          {(() => {
                            const card = cards.find(c => c.id === selectedCardId);
                            if (!card || !card.worker_name) {
                              return <span className="text-slate-400 font-medium text-[10px]">لم يحدد اسم فني</span>;
                            }
                            const list = card.worker_name.split(/[،,\n\r]+/).map((w: string) => w.trim()).filter((w: string) => w.length > 0);
                            return list.map((w, widx) => (
                              <span key={widx} className="bg-yellow-100 text-yellow-950 border border-yellow-300 px-1.5 py-0.5 rounded text-[10px] font-black">
                                {w}
                              </span>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Exit Date */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>تاريخ مغادرة الورشة وخروج المركبة</span>
                    </label>
                    <input
                      id="date_out_input"
                      type="datetime-local"
                      value={dateOut}
                      onChange={(e) => {
                        setDateOut(e.target.value);
                        isDirtyRef.current = true;
                      }}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none transition-all text-slate-800 text-sm"
                      required
                    />
                  </div>
                </div>

                {/* Signature blocks */}
                <div className="space-y-4">
                  <h3 className="block text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b pb-2">
                    <span>الاعتماد والتوقيع النهائي عند الخروج (اختياري):</span>
                  </h3>

                  <div className="grid grid-cols-1 gap-5">
                    {/* Manager Signature */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>مسؤول الورشة الفنية المباشر (المعتمد)</span>
                        <span className="text-slate-300 text-[10px] font-normal">(اختياري)</span>
                      </label>
                      <input
                        id="sig_manager_input"
                        type="text"
                        value={sigManager}
                        onChange={(e) => {
                          setSigManager(e.target.value);
                          isDirtyRef.current = true;
                        }}
                        placeholder="أدخل اسم مسؤول الورشة..."
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none transition-all text-slate-800 font-medium placeholder:text-slate-400 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <button
                  id="btn_submit_checkout"
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.99] disabled:opacity-50 text-xs sm:text-sm"
                >
                  {isLoading ? (
                    <span>جاري ترحيل وإغلاق الملف...</span>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      <span>تسجيل خروج المركبة رسميّاً وترحيل البطاقة للسجل</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
