/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { createServer as createViteServer } from "vite";

interface MaintenanceCard {
  id: string;
  vehicle_id: string;
  driver_name: string;
  trailer_id?: string;
  damage_type?: string;
  date_in: string;
  date_out?: string;
  status: 'check_in' | 'maintenance' | 'completed';
  destination?: 'workshop' | 'parking';
  transferred_to_workshop_at?: string;
  diagnosis?: string;
  repair_details?: string;
  parts?: string;
  work_team?: string;
  worker_name?: string;
  signature_mechanic?: string;
  signature_electrician?: string;
  signature_manager?: string;
}

interface AppConfig {
  db_path: string;
  default_vehicles: string[];
  default_drivers: string[];
  default_work_teams: string[];
  default_workers: string[];
  driver_phones?: Record<string, string>;
  worker_phones?: Record<string, string>;
  html_template: string;
  daily_report_template?: string;
  monthly_report_template?: string;
}

const DEFAULT_HTML_TEMPLATE = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>بطاقة صيانة رقم {{id}}</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      margin: 0;
      padding: 15px;
      direction: rtl;
      color: #333;
      background-color: #fff;
    }
    .container {
      border: 2px solid #1a202c;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
      border-radius: 6px;
    }
    .header {
      text-align: center;
      border-bottom: 2px double #1a202c;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      color: #1a202c;
    }
    .header p {
      margin: 5px 0 0;
      font-size: 14px;
      color: #4a5568;
    }
    .section-title {
      font-size: 16px;
      font-weight: bold;
      background: #edf2f7;
      padding: 8px 12px;
      margin-top: 20px;
      margin-bottom: 10px;
      border-right: 4px solid #3182ce;
      border-radius: 0 4px 4px 0;
    }
    .grid-info {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    .info-item {
      display: flex;
      border-bottom: 1px dashed #cbd5e0;
      padding-bottom: 5px;
    }
    .info-label {
      font-weight: bold;
      min-width: 120px;
      color: #2d3748;
    }
    .info-value {
      color: #4a5568;
    }
    table.maint-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      margin-bottom: 25px;
    }
    table.maint-table th, table.maint-table td {
      border: 1px solid #1a202c;
      padding: 10px;
      text-align: right;
      vertical-align: top;
      font-size: 14px;
    }
    table.maint-table th {
      background-color: #edf2f7;
      font-weight: bold;
      color: #2d3748;
    }
    .signatures-section {
      margin-top: 30px;
    }
    .signatures-grid {
      display: grid;
      grid-template-columns: minmax(200px, 300px);
      gap: 15px;
      margin-top: 15px;
    }
    .sig-box {
      border: 1px solid #718096;
      border-radius: 4px;
      padding: 8px;
      text-align: center;
      min-height: 80px;
    }
    .sig-title {
      font-weight: bold;
      border-bottom: 1px solid #cbd5e0;
      padding-bottom: 5px;
      margin-bottom: 15px;
      color: #2d3748;
    }
    .sig-value {
      font-style: italic;
      color: #2b6cb0;
      font-size: 14px;
      font-weight: bold;
    }
    .exit-date {
      margin-bottom: 15px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>بطاقة صيانة المركبة للورشة الفنية</h1>
      <p>نظام إدارة ومتابعة البطاقات الفنية الموحدة</p>
    </div>

    <div class="section-title">الجزء الأول: البيانات الأساسية لبطاقة الدخول</div>
    <div class="grid-info">
      <div class="info-item">
        <span class="info-label">الرقم التسلسلي:</span>
        <span class="info-value" style="font-weight: bold;">{{id}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">رقم المركبة:</span>
        <span class="info-value">{{vehicle_id}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">رقم المقطورة:</span>
        <span class="info-value">{{trailer_id}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">اسم السائق:</span>
        <span class="info-value">{{driver_name}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">تاريخ الدخول:</span>
        <span class="info-value">{{date_in}}</span>
      </div>
      <div class="info-item">
        <span class="info-label">نوع العطب:</span>
        <span class="info-value">{{damage_type}}</span>
      </div>
    </div>

    <div class="section-title">الجزء الثاني: جدول الصيانة وقطع الغيار</div>
    <table class="maint-table">
      <thead>
        <tr>
          <th style="width: 25%;">قطع الغيار المستبدل</th>
          <th style="width: 25%;">إصلاح العطب</th>
          <th style="width: 25%;">تشخيص الميكانيكي</th>
          <th style="width: 25%;">طاقم العمل والمسؤول</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{{parts}}</td>
          <td>{{repair_details}}</td>
          <td>{{diagnosis}}</td>
          <td>{{work_team}}<br/><span style="display: inline-block; margin-top: 5px; font-size: 12px; color: #4a5568;\"><strong>العامل المنفذ:</strong> {{worker_name}}</span></td>
        </tr>
      </tbody>
    </table>

    <div class="section-title">الجزء الثالث: اعتماد خروج المركبة والتواقيع</div>
    <div class="signatures-section">
      <div class="exit-date">تاريخ الخروج المعتمد: <span style="font-weight: normal; margin-right: 10px;">{{date_out}}</span></div>
      <div class="signatures-grid">
        <div class="sig-box">
          <div class="sig-title">مسؤول الورشة الفنية المباشر</div>
          <div class="sig-value">{{signature_manager}}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

const DEFAULT_DAILY_REPORT_TEMPLATE = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>تقرير الصيانة اليومي - تاريخ {{target_date}}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 25px;
      background-color: #fff;
      color: #1e293b;
      direction: rtl;
    }
    .report-container {
      border: 3px double #0f172a;
      padding: 30px;
      border-radius: 12px;
      max-width: 1000px;
      margin: 0 auto;
      position: relative;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 15px;
      margin-bottom: 25px;
    }
    .header-title {
      text-align: center;
      flex: 1;
    }
    .header-title h1 {
      font-size: 22px;
      margin: 0 0 5px 0;
      color: #0f172a;
      font-weight: 900;
    }
    .header-title p {
      font-size: 13px;
      color: #475569;
      margin: 0;
      font-weight: 600;
    }
    .side-branding {
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
      font-weight: bold;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 25px;
    }
    .stat-card {
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }
    .stat-num {
      font-size: 22px;
      font-weight: 800;
      color: #1d4ed8;
    }
    .stat-label {
      font-size: 11px;
      font-weight: bold;
      color: #475569;
      margin-top: 4px;
    }
    .table-title {
      font-size: 14px;
      font-weight: 850;
      color: #0f172a;
      margin-bottom: 12px;
      background-color: #f1f5f9;
      padding: 6px 12px;
      border-right: 4px solid #1d4ed8;
    }
    .report-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .report-table th, .report-table td {
      border: 1px solid #94a3b8;
      padding: 8px 10px;
      font-size: 11.5px;
      text-align: right;
      vertical-align: top;
    }
    .report-table th {
      background-color: #f1f5f9;
      font-weight: bold;
      color: #0f172a;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: bold;
    }
    .badge-check_in { background-color: #dbeafe; color: #1e40af; }
    .badge-maintenance { background-color: #fef9c3; color: #854d0e; }
    .badge-completed { background-color: #d1fae5; color: #065f46; }
    
    .signature-section {
      margin-top: 45px;
      padding-top: 20px;
      border-top: 1px dashed #cbd5e1;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      text-align: center;
    }
    .sig-box {
      font-size: 12px;
      color: #334155;
    }
    .sig-title {
      font-weight: bold;
      margin-bottom: 45px;
      color: #0d172a;
    }
    .sig-line {
      border-top: 1px solid #94a3b8;
      width: 80%;
      margin: 0 auto;
      padding-top: 5px;
    }
    @media print {
      body { padding: 0; }
      .report-container { border: 2px solid #000; border-radius: 0; box-shadow: none; width: 100%; box-sizing: border-box; }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header-box">
      <div class="side-branding text-right">
        إدارة النقليات والوكالة العامة<br/>
        قسم الصيانة والورشة الفنية الموحدة<br/>
        قاعدة بيانات: النشطة والمكتملة
      </div>
      
      <div class="header-title">
        <h1>التقرير الفني اليومي لحركة الورشة والتشغيل</h1>
        <p>يوم الصيانة الفنية: <strong>{{target_date_formatted}}</strong>  •  الموافق لـ {{target_date}}</p>
      </div>
      
      <div class="side-branding text-left" style="text-align: left;">
        تاريخ الطباعة: {{print_date}}<br/>
        وقت الاستخراج: {{print_time}}<br/>
        رقم ملف السجل: {{report_ref}}
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-num">{{total_active}}</div>
        <div class="stat-label">نشاط الصيانة الإجمالي</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{new_checkins}}</div>
        <div class="stat-label font-bold text-blue-600">دخلت الورشة اليوم</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" style="color: #10b981;">{{completed_today}}</div>
        <div class="stat-label text-emerald-500">تم إصلاحها وغادرت اليوم</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" style="color: #f59e0b;">{{in_progress_today}}</div>
        <div class="stat-label text-yellow-500">قيد العمل (مستمرة للغد)</div>
      </div>
    </div>

    <div class="table-title">تفاصيل حركة وبطاقات الصيانة الفنية خلال اليوم ({{target_date}})</div>
    
    <table class="report-table">
      <thead>
        <tr>
          <th style="width: 10%;">البطاقة</th>
          <th style="width: 15%;">المركبة / المقطورة</th>
          <th style="width: 15%;">اسم السائق</th>
          <th style="width: 20%;">طبيعة العطب الشاكي</th>
          <th style="width: 20%;">إجراءات وأعمال الإصلاح</th>
          <th style="width: 12%;">القطع المبدلة</th>
          <th style="width: 8%;">الحالة</th>
        </tr>
      </thead>
      <tbody>
        {{table_rows}}
      </tbody>
    </table>

    <div class="signature-section">
      <div class="sig-box">
        <div class="sig-title">مسؤول الفرقة والمنفذ المباشر</div>
        <div class="sig-line">توقيع المعني</div>
      </div>
      
      <div class="sig-box">
        <div class="sig-title">مراراق الورشة ورئيس الصيانة</div>
        <div class="sig-line">الاعتماد والملاحظات</div>
      </div>
      
      <div class="sig-box">
        <div class="sig-title">المدير الفني المعتمد للأسطول</div>
        <div class="sig-line">المصادقة والتوجيه</div>
      </div>
    </div>
    
    <div style="margin-top:40px; font-size: 9.5px; text-align: center; color: #94a3b8; font-weight: bold;">
      * تم استخراج وطباعة هذا التقرير تلقائياً من نظام التقارير الرقمية وأرشيف الورشة ولا يعتد به رسمياً بدون التواقيع الحية والأختام المعتمدة.
    </div>
  </div>
</body>
</html>`;

const DEFAULT_MONTHLY_REPORT_TEMPLATE = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>تقرير الصيانة الشهري - {{month_label}}</title>
  <style>
    body {
      font-family: Arial, 'Segoe UI', Tahoma, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f8fafc;
      color: #1e293b;
    }
    .report-container {
      background: white;
      border: 2px solid #0f172a;
      padding: 30px;
      border-radius: 8px;
      max-width: 1050px;
      margin: 0 auto;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px double #0f172a;
      padding-bottom: 20px;
      margin-bottom: 25px;
    }
    .header-title {
      text-align: center;
      flex: 1;
    }
    .header-title h1 {
      font-size: 24px;
      margin: 0;
      color: #0f172a;
      font-weight: 800;
    }
    .header-title p {
      font-size: 14px;
      color: #475569;
      margin: 6px 0 0 0;
    }
    .side-branding {
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
      font-weight: 600;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 30px;
    }
    .stat-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 15px;
      text-align: center;
    }
    .stat-num {
      font-size: 26px;
      font-weight: 800;
      color: #2563eb;
      margin-bottom: 4px;
    }
    .stat-label {
      font-size: 12px;
      font-weight: bold;
      color: #475569;
    }
    .table-title {
      font-size: 16px;
      font-weight: bold;
      color: #0f172a;
      margin-bottom: 12px;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 6px;
    }
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 25px;
    }
    .summary-table th, .summary-table td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      font-size: 11.5px;
      text-align: right;
    }
    .summary-table th {
      background-color: #f1f5f9;
      font-weight: bold;
      color: #0f172a;
    }
    .summary-table tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .signature-section {
      margin-top: 35px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      text-align: center;
    }
    .sig-box {
      font-size: 12px;
      color: #334155;
    }
    .sig-title {
      font-weight: bold;
      margin-bottom: 40px;
      color: #0f172a;
    }
    .sig-line {
      border-top: 1px solid #94a3b8;
      width: 75%;
      margin: 0 auto;
      padding-top: 5px;
    }
    @media print {
      body {
        padding: 0;
        background: white;
      }
      .report-container {
        box-shadow: none;
        margin: 0;
        border: 2px solid #000;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header-box">
      <div class="side-branding text-right">
        إدارة النقليات والوكالة العامة<br/>
        قسم الصيانة والورشة الفنية الموحدة<br/>
        أرشيف السجلات الشهرية
      </div>
      
      <div class="header-title">
        <h1>تقرير الصيانة والتشغيل الشهري للورشة</h1>
        <p>البطاقات الفنية المكتملة والمغلقة لشهر: <strong>{{month_label}}</strong></p>
      </div>
      
      <div class="side-branding text-left" style="text-align: left;">
        تاريخ الطباعة: {{print_date}}<br/>
        المرجع الإحصائي: {{report_ref}}<br/>
        الحالة: بطاقات معتمدة ومقفلة
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-num">{{total_cards}}</div>
        <div class="stat-label">بطاقة صيانة مغلقة</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{unique_vehicles}}</div>
        <div class="stat-label">مركبة تم إصلاحها</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">{{unique_drivers}}</div>
        <div class="stat-label">سائق مستفيد</div>
      </div>
    </div>

    <div class="table-title">جدول بيان بطاقات وأعمال الصيانة المنجزة خلال الشهر:</div>
    <table class="summary-table">
      <thead>
        <tr>
          <th style="width: 12%;">رقم البطاقة</th>
          <th style="width: 15%;">المركبة / المقطورة</th>
          <th style="width: 14%;">اسم السائق</th>
          <th style="width: 18%;">العطب والتشخيص</th>
          <th style="width: 20%;">إجراءات وأعمال الإصلاح</th>
          <th style="width: 13%;">القطع المستبدلة</th>
          <th style="width: 8%;">تاريخ الإنجاز</th>
        </tr>
      </thead>
      <tbody>
        {{table_rows}}
      </tbody>
    </table>

    <div class="signature-section">
      <div class="sig-box">
        <div class="sig-title">مسؤول الفرقة والمنفذ المباشر</div>
        <div class="sig-line">توقيع المعني</div>
      </div>
      
      <div class="sig-box">
        <div class="sig-title">مراقب الورشة ورئيس الصيانة</div>
        <div class="sig-line">الاعتماد والملاحظات</div>
      </div>
      
      <div class="sig-box">
        <div class="sig-title">المدير الفني المعتمد للأسطول</div>
        <div class="sig-line">المصادقة والتوجيه</div>
      </div>
    </div>
    
    <div style="margin-top: 40px; font-size: 10px; text-align: center; color: #94a3b8; font-weight: bold; border-top: 1px dashed #cbd5e1; padding-top: 15px;">
      * تم استخراج واعتماد هذا التقرير الشهري الشامل تلقائياً من نظام إدارة وأرشفة الصيانة الفنية للأسطول ولا يعتد به رسمياً بدون التواقيع الحية والأختام المعتمدة.
    </div>
  </div>
</body>
</html>`;

const CONFIG_PATH = path.join(process.cwd(), "config.json");
const DEFAULT_DB_PATH = path.join(process.cwd(), "maintenance.db");

// Load Configuration safely
function loadConfig(): AppConfig {
  let config: AppConfig;
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, "utf-8");
      config = JSON.parse(data);
    } else {
      config = {
        db_path: "./maintenance.db",
        default_vehicles: ["شاحنة ACTROS - 2042", "شاحنة VOLVO - FH16"],
        default_drivers: ["أحمد محمد الحارثي", "سليمان خالد الدوسري"],
        default_work_teams: ["مجموعة ميكانيكا ورشة أ", "مجموعة الكهرباء ورشة ب"],
        default_workers: ["ميكانيكي م. سليم الحربي", "كهربائي م. علي الجابري", "فني ميكانيكا خالد العتيبي", "كهربائي سيارات فهد سليمان", "فني هيدروليك يوسف الغامدي", "مساعد فني رائد الحازمي"],
        html_template: ""
      };
    }
  } catch (error) {
    console.error("Error loading config.json, using fallback defaults:", error);
    config = {
      db_path: "./maintenance.db",
      default_vehicles: ["شاحنة ACTROS - 2042", "شاحنة VOLVO - FH16"],
      default_drivers: ["أحمد محمد الحارثي", "سليمان خالد الدوسري"],
      default_work_teams: ["مجموعة ميكانيكا ورشة أ", "مجموعة الكهرباء ورشة ب"],
      default_workers: ["ميكانيكي م. سليم الحربي", "كهربائي م. علي الجابري", "فني ميكانيكا خالد العتيبي", "كهربائي سيارات فهد سليمان", "فني هيدروليك يوسف الغامدي", "مساعد فني رائد الحازمي"],
      html_template: ""
    };
  }

  // Backwards compatibility / defaults
  if (!config.html_template) {
    config.html_template = DEFAULT_HTML_TEMPLATE;
  }
  if (!config.daily_report_template) {
    config.daily_report_template = DEFAULT_DAILY_REPORT_TEMPLATE;
  }
  if (!config.monthly_report_template) {
    config.monthly_report_template = DEFAULT_MONTHLY_REPORT_TEMPLATE;
  }
  if (!config.driver_phones) {
    config.driver_phones = {};
  }
  if (!config.worker_phones) {
    config.worker_phones = {};
  }

  return config;
}

// Save Configuration safely with atomic write
function saveConfig(config: AppConfig) {
  const tempPath = `${CONFIG_PATH}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(config, null, 2), "utf-8");
    fs.renameSync(tempPath, CONFIG_PATH);
  } catch (error) {
    console.error("Error saving config.json:", error);
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
  }
}

// Load Database safely
function loadDatabase(dbPath: string): MaintenanceCard[] {
  const resolvedPath = path.resolve(process.cwd(), dbPath);
  try {
    if (fs.existsSync(resolvedPath)) {
      const data = fs.readFileSync(resolvedPath, "utf-8");
      try {
        const cards: MaintenanceCard[] = JSON.parse(data);
        let cleaned = false;
        cards.forEach(c => {
          if (c.parts && (c.parts.trim() === "[]" || c.parts.trim() === "")) {
            c.parts = "";
            cleaned = true;
          }
          if (c.repair_details && (c.repair_details.trim() === "[]" || c.repair_details.trim() === "")) {
            c.repair_details = "";
            cleaned = true;
          }
        });
        if (cleaned) {
          saveDatabase(dbPath, cards);
        }
        return cards;
      } catch {
        // Fallback or read as raw database lines/JSON
        return [];
      }
    }
  } catch (error) {
    console.error("Error loading database:", error);
  }
  return [];
}

// Save Database safely with atomic write (prevents corruption on concurrent writes)
function saveDatabase(dbPath: string, data: MaintenanceCard[]) {
  const resolvedPath = path.resolve(process.cwd(), dbPath);
  const tempPath = `${resolvedPath}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempPath, resolvedPath);
  } catch (error) {
    console.error("Error saving database file:", error);
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
  }
}

// Helper: Determine local IP address in LAN
function getLocalIpAddress(): string {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (net.family === "IPv4" && !net.internal && net.address !== "127.0.0.1") {
          return net.address;
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return "localhost";
}

// Real-Time SSE Synchronization for Multi-Device LAN usage
interface SyncEvent {
  type: "cards_updated" | "config_updated" | "presence";
  action?: "create" | "update" | "delete" | "transfer" | "format" | "import";
  cardId?: string;
  card?: MaintenanceCard;
  summary?: string;
  connectedClients?: number;
  serverIp?: string;
  timestamp: number;
}

const sseClients = new Set<express.Response>();
let presenceTimer: any = null;
let lastKnownClientCount = -1;

function schedulePresenceBroadcast() {
  if (presenceTimer) clearTimeout(presenceTimer);
  presenceTimer = setTimeout(() => {
    const currentCount = sseClients.size;
    if (currentCount !== lastKnownClientCount) {
      lastKnownClientCount = currentCount;
      broadcastSyncEvent({
        type: "presence",
        connectedClients: currentCount,
        serverIp: getLocalIpAddress(),
        timestamp: Date.now()
      });
    }
  }, 1200);
}

function broadcastSyncEvent(event: SyncEvent) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of Array.from(sseClients)) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Format Parts for HTML template rendering
function formatPartsHTML(partsStr?: string): string {
  if (!partsStr || partsStr.trim() === "[]" || partsStr.trim() === "") return "—";
  const trimmed = partsStr.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return "—";
        const valid = parsed.filter((item: any) => (item.name || item.description || "").trim().length > 0 && (item.name || item.description || "").trim() !== "[]");
        if (valid.length === 0) return "—";
        return `<ul style="margin: 0; padding-right: 15px; text-align: right; direction: rtl; font-family: inherit; line-height: 1.4;">` +
          valid.map((item: any) => {
            const name = item.name || item.description || "—";
            const targetTag = item.target === "trailer" ? ` <span style="font-size: 11px; color: #b45309; background-color: #fef3c7; padding: 1px 4px; border-radius: 3px; font-weight: bold;">[المقطورة]</span>` : "";
            const dateStr = item.date ? ` <span style="font-size: 11px; color: #475569; font-weight: normal;">(تاريخ الاستبدال: ${item.date})</span>` : "";
            return `<li style="margin-bottom: 6px;"><strong>${name}</strong>${targetTag}${dateStr}</li>`;
          }).join("") +
          `</ul>`;
      }
    } catch (e) {
      // ignore parsing error and treat as raw text
    }
  }
  return partsStr;
}

// Format Repair actions for table and report rendering
function parseRepairsHTML(repairDetails?: string): string {
  if (!repairDetails || repairDetails.trim() === "[]" || repairDetails.trim() === "") return "—";
  const trimmed = repairDetails.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return "—";
        return `<ol style="margin: 0; padding-right: 15px; text-align: right; line-height: 1.4;">` +
          parsed.map(item => {
            const desc = item.description || item.action || "—";
            const workerInfo = Array.isArray(item.workers) && item.workers.length > 0 ? ` <span style="font-size: 10px; color: #64748b;">(الفني: ${item.workers.join("، ")})</span>` : "";
            return `<li style="margin-bottom: 4px;">${desc}${workerInfo}</li>`;
          }).join("") +
          `</ol>`;
      }
    } catch(e) {}
  }
  return repairDetails;
}

// Format parts as compact inline text for summary tables
function parsePartsHTMLLocal(partsStr?: string): string {
  if (!partsStr || partsStr.trim() === "[]" || partsStr.trim() === "") return "—";
  const trimmed = partsStr.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return "—";
        const valid = parsed.filter((item: any) => (item.name || item.description || "").trim().length > 0 && (item.name || item.description || "").trim() !== "[]");
        if (valid.length === 0) return "—";
        return valid.map((item: any) => {
          const name = item.name || item.description || "—";
          const targetTag = item.target === "trailer" ? " [مقطورة]" : "";
          return `${name}${targetTag}`;
        }).join("، ");
      }
    } catch(e) {}
  }
  return partsStr;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // CORS & Network optimization for multi-computer LAN access
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // API - Network and multi-device connection info for LAN
  app.get("/api/network-info", (req, res) => {
    const ip = getLocalIpAddress();
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({
      ip,
      port: PORT,
      localUrl: `http://${ip}:${PORT}`,
      hostname: os.hostname(),
      connectedClients: Math.max(1, sseClients.size),
      serverTime: new Date().toISOString()
    });
  });

  // API - Server-Sent Events (SSE) stream for real-time live synchronization across all computers
  app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    // Send initial comment and presence event only to the connecting client
    res.write(`: connected\n\n`);
    const initialEvent: SyncEvent = {
      type: "presence",
      connectedClients: sseClients.size + 1,
      serverIp: getLocalIpAddress(),
      timestamp: Date.now()
    };
    res.write(`data: ${JSON.stringify(initialEvent)}\n\n`);

    sseClients.add(res);

    // Debounced broadcast to all clients to prevent reconnect storms
    schedulePresenceBroadcast();

    // Heartbeat every 15 seconds to keep connection alive through proxies/routers
    const heartbeat = setInterval(() => {
      try {
        res.write(": keep-alive\n\n");
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
      schedulePresenceBroadcast();
    });
  });

  // API - Get App Config
  app.get("/api/config", (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    const config = loadConfig();
    res.json(config);
  });

  // API - Save HTML template or autocomplete options
  app.post("/api/config", (req, res) => {
    const current = loadConfig();
    const updated = { ...current, ...req.body };
    saveConfig(updated);
    broadcastSyncEvent({ type: "config_updated", action: "update", timestamp: Date.now() });
    res.json({ success: true, config: updated });
  });

  // API - Format Database with secret code
  app.post("/api/database/format", (req, res) => {
    const { code } = req.body;
    if (code === "0659155323") {
      const config = loadConfig();
      saveDatabase(config.db_path, []);
      broadcastSyncEvent({ type: "cards_updated", action: "format", summary: "تمت تهيئة قاعدة البيانات", timestamp: Date.now() });
      res.json({ success: true, message: "تمت تهيئة وفرمطة قاعدة البيانات بالكامل بنجاح!" });
    } else {
      res.status(400).json({ error: "رمز التفعيل غير صحيح، يرجى إدخال الرقم الصحيح لإجراء عملية الفرمتة." });
    }
  });

  // API - Get list of maintenance cards
  app.get("/api/cards", (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    const config = loadConfig();
    let cards = loadDatabase(config.db_path);
    
    // Sort cards so newer entries correspond to descending ID values
    cards.sort((a, b) => b.id.localeCompare(a.id));

    const { status, search, vehicle_id } = req.query;

    if (status) {
      cards = cards.filter(c => c.status === status);
    }
    
    if (vehicle_id) {
      cards = cards.filter(c => c.vehicle_id === vehicle_id);
    }

    if (search) {
      const query = String(search).toLowerCase();
      cards = cards.filter(c => 
        c.id.toLowerCase().includes(query) ||
        c.vehicle_id.toLowerCase().includes(query) ||
        c.driver_name.toLowerCase().includes(query) ||
        (c.trailer_id && c.trailer_id.toLowerCase().includes(query)) ||
        (c.damage_type && c.damage_type.toLowerCase().includes(query))
      );
    }

    res.json(cards);
  });

  // API - Get single card
  app.get("/api/cards/:id", (req, res) => {
    const config = loadConfig();
    const cards = loadDatabase(config.db_path);
    const card = cards.find(c => c.id === req.params.id);
    
    if (!card) {
      return res.status(404).json({ error: "الصيانة غير موجودة" });
    }
    res.json(card);
  });

  // API - Create card (Vehicle Check-in)
  app.post("/api/cards", (req, res) => {
    const config = loadConfig();
    const cards = loadDatabase(config.db_path);

    const { vehicle_id, driver_name, trailer_id, damage_type, date_in, destination } = req.body;
    const trimmedVehicle = vehicle_id ? vehicle_id.trim() : "";
    const trimmedTrailer = trailer_id ? trailer_id.trim() : "";
    const trimmedDriver = driver_name ? driver_name.trim() : "";

    if (!trimmedVehicle && !trimmedTrailer) {
      return res.status(400).json({ error: "يجب إدخال رقم المركبة أو رقم المقطورة (أحدهما على الأقل)" });
    }
    if (!trimmedDriver) {
      return res.status(400).json({ error: "اسم السائق حقل إجبارى" });
    }

    // Check for existing active duplicate vehicle or trailer (in workshop or parking)
    const existingActive = cards.find(c => {
      if (c.status === "completed") return false;
      const matchVehicle = !!trimmedVehicle && !!c.vehicle_id && c.vehicle_id.trim().toLowerCase() === trimmedVehicle.toLowerCase();
      const matchTrailer = !!trimmedTrailer && !!c.trailer_id && c.trailer_id.trim().toLowerCase() === trimmedTrailer.toLowerCase();
      return matchVehicle || matchTrailer;
    });

    if (existingActive) {
      const locLabel = existingActive.destination === "parking" ? "موقف المركبات" : "الورشة الفنية";
      return res.status(409).json({
        error: `المركبة موجودة بالفعل بالنظام وتتواجد حالياً في ${locLabel} برقم بطاقة (${existingActive.id}). لا يمكن إدخالها مرتين!`,
        duplicateCard: existingActive,
        location: existingActive.destination === "parking" ? "parking" : "workshop"
      });
    }

    // Generate Sequence Serial
    const year = new Date().getFullYear();
    const prefix = `MV-${year}-`;
    const yearCards = cards.filter(c => c.id.startsWith(prefix));
    
    let maxNum = 0;
    yearCards.forEach(c => {
      const numPart = parseInt(c.id.slice(prefix.length), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    });

    const nextNum = maxNum + 1;
    const serialId = `${prefix}${String(nextNum).padStart(4, "0")}`;

    const targetDestination: 'workshop' | 'parking' = destination === "parking" ? "parking" : "workshop";

    const newCard: MaintenanceCard = {
      id: serialId,
      vehicle_id: trimmedVehicle,
      driver_name: trimmedDriver,
      trailer_id: trimmedTrailer,
      damage_type: damage_type ? damage_type.trim() : "",
      date_in: date_in || new Date().toISOString().split("T")[0],
      destination: targetDestination,
      status: "check_in"
    };

    cards.push(newCard);
    saveDatabase(config.db_path, cards);

    // Dynamic autocomplete update
    let updatedConfig = false;
    if (vehicle_id && !config.default_vehicles.includes(vehicle_id.trim())) {
      config.default_vehicles.push(vehicle_id.trim());
      updatedConfig = true;
    }
    if (driver_name && !config.default_drivers.includes(driver_name.trim())) {
      config.default_drivers.push(driver_name.trim());
      updatedConfig = true;
    }
    if (updatedConfig) {
      saveConfig(config);
    }

    res.status(201).json({ success: true, card: newCard });

    // Real-Time LAN broadcast to all other computers
    broadcastSyncEvent({
      type: "cards_updated",
      action: "create",
      card: newCard,
      cardId: newCard.id,
      summary: `تم تسجيل دخول مركبة جديدة: ${newCard.vehicle_id || newCard.trailer_id || ''}`,
      timestamp: Date.now()
    });
  });

  // API - Transfer Vehicle from Parking to Workshop
  app.post("/api/cards/:id/transfer-to-workshop", (req, res) => {
    const config = loadConfig();
    const cards = loadDatabase(config.db_path);
    const cardIndex = cards.findIndex(c => c.id === req.params.id);

    if (cardIndex === -1) {
      return res.status(404).json({ error: "البطاقة غير موجودة" });
    }

    const nowIso = new Date().toISOString();
    cards[cardIndex].destination = "workshop";
    cards[cardIndex].transferred_to_workshop_at = nowIso;

    saveDatabase(config.db_path, cards);
    res.json({ success: true, message: "تم توجيه المركبة إلى الورشة الفنية بنجاح", card: cards[cardIndex] });

    // Real-Time LAN broadcast
    broadcastSyncEvent({
      type: "cards_updated",
      action: "transfer",
      card: cards[cardIndex],
      cardId: cards[cardIndex].id,
      summary: `تم توجيه المركبة (${cards[cardIndex].vehicle_id || ''}) من الموقف للورشة`,
      timestamp: Date.now()
    });
  });

  // API - Update card (Maintenance / Check-out)
  app.put("/api/cards/:id", (req, res) => {
    const config = loadConfig();
    const cards = loadDatabase(config.db_path);
    const cardIndex = cards.findIndex(c => c.id === req.params.id);

    if (cardIndex === -1) {
      return res.status(404).json({ error: "البطاقة غير موجودة" });
    }

    const originalCard = cards[cardIndex];
    const updateData = req.body;

    if (typeof updateData.parts === "string" && (updateData.parts.trim() === "[]" || updateData.parts.trim() === "")) {
      updateData.parts = "";
    }
    if (typeof updateData.repair_details === "string" && (updateData.repair_details.trim() === "[]" || updateData.repair_details.trim() === "")) {
      updateData.repair_details = "";
    }

    // Merge changes
    const updatedCard: MaintenanceCard = {
      ...originalCard,
      ...updateData
    };

    // If changing state to completed or maintenance, clean work_team dynamic list
    let updatedConfig = false;
    if (updateData.work_team && !config.default_work_teams.includes(updateData.work_team.trim())) {
      config.default_work_teams.push(updateData.work_team.trim());
      updatedConfig = true;
    }
    if (updateData.worker_name) {
      if (!config.default_workers) config.default_workers = [];
      const workersList = updateData.worker_name.split(/[،,\n\r]+/).map((w: string) => w.trim()).filter((w: string) => w.length > 0);
      let configUpdatedForWorkers = false;
      workersList.forEach((worker: string) => {
        if (!config.default_workers.includes(worker) && worker !== "—" && worker !== "لم يحدد") {
          config.default_workers.push(worker);
          configUpdatedForWorkers = true;
        }
      });
      if (configUpdatedForWorkers) {
        updatedConfig = true;
      }
    }
    if (updatedConfig) {
      saveConfig(config);
    }

    cards[cardIndex] = updatedCard;
    saveDatabase(config.db_path, cards);

    res.json({ success: true, card: updatedCard });

    // Real-Time LAN broadcast
    broadcastSyncEvent({
      type: "cards_updated",
      action: "update",
      card: updatedCard,
      cardId: updatedCard.id,
      summary: `تم تحديث بطاقة الصيانة (${updatedCard.id})`,
      timestamp: Date.now()
    });
  });

  // API - Delete card (Admin clean up option)
  app.delete("/api/cards/:id", (req, res) => {
    const config = loadConfig();
    const cards = loadDatabase(config.db_path);
    const index = cards.findIndex(c => c.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: "البطاقة غير موجودة" });
    }

    cards.splice(index, 1);
    saveDatabase(config.db_path, cards);
    res.json({ success: true });

    // Real-Time LAN broadcast
    broadcastSyncEvent({
      type: "cards_updated",
      action: "delete",
      cardId: req.params.id,
      summary: `تم حذف بطاقة الصيانة (${req.params.id})`,
      timestamp: Date.now()
    });
  });

  // API - Export full database and configuration backup
  app.get("/api/backup/export", (req, res) => {
    try {
      const config = loadConfig();
      const cards = loadDatabase(config.db_path);
      
      const backupData = {
        backup_version: "2.0",
        timestamp: new Date().toISOString(),
        cards: cards,
        config: config
      };

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename=maintenance_database_backup_${new Date().toISOString().split('T')[0]}.json`);
      res.send(JSON.stringify(backupData, null, 2));
    } catch (error: any) {
      console.error("Export backup error:", error);
      res.status(500).json({ error: "فشل إنشاء وتصدير النسخة الاحتياطية لقاعدة البيانات" });
    }
  });

  // API - Import full database and configuration backup
  app.post("/api/backup/import", (req, res) => {
    try {
      const { cards, config } = req.body;

      if (!cards || !Array.isArray(cards)) {
        return res.status(400).json({ error: "ملف النسخة الاحتياطية غير صالح: مفقود قائمة بطاقات الصيانة." });
      }

      // Check if all items look like Maintenance Cards roughly
      const isValid = cards.every(c => c && typeof c === "object" && typeof c.id === "string" && typeof c.vehicle_id === "string");
      if (!isValid && cards.length > 0) {
        return res.status(400).json({ error: "محتوى الملف غير متوافق: تنسيق بطاقات الصيانة غير مطابق للشروط الفنية." });
      }

      // Load active config to find the db path
      const currentConfig = loadConfig();

      // Write standard db
      saveDatabase(currentConfig.db_path, cards);

      // Restore configuration lists if present
      if (config) {
        const mergedConfig = {
          ...currentConfig,
          default_vehicles: Array.from(new Set([...(config.default_vehicles || []), ...currentConfig.default_vehicles])),
          default_drivers: Array.from(new Set([...(config.default_drivers || []), ...currentConfig.default_drivers])),
          default_work_teams: Array.from(new Set([...(config.default_work_teams || []), ...currentConfig.default_work_teams])),
          default_workers: Array.from(new Set([...(config.default_workers || []), ...currentConfig.default_workers])),
          driver_phones: { ...(currentConfig.driver_phones || {}), ...(config.driver_phones || {}) },
          worker_phones: { ...(currentConfig.worker_phones || {}), ...(config.worker_phones || {}) }
        };
        saveConfig(mergedConfig);
      }

      res.json({ success: true, message: "تم استيراد قاعدة البيانات واستعادة النسخة الاحتياطية بنجاح!" });

      // Real-Time LAN broadcast
      broadcastSyncEvent({
        type: "cards_updated",
        action: "import",
        summary: "تم استيراد نسخة احتياطية للبيانات",
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error("Import backup error:", error);
      res.status(500).json({ error: "حدث عطل فني داخلي أثناء محاولة استيراد قاعدة البيانات" });
    }
  });

  // API - Render HTML Template for printing / export
  app.get("/api/reports/monthly/render", (req, res) => {
    const config = loadConfig();
    const cards = loadDatabase(config.db_path);
    const targetMonth = req.query.month ? String(req.query.month).substring(0, 7) : new Date().toISOString().substring(0, 7);

    const completed = cards.filter(c => {
      if (c.status !== "completed") return false;
      const dateStr = c.date_out || c.date_in;
      return dateStr && dateStr.startsWith(targetMonth);
    });

    if (completed.length === 0) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
          <head>
            <meta charset="utf-8">
            <title>لا توجد بيانات</title>
            <style>
              body { font-family: sans-serif; text-align: center; padding: 50px; background-color: #f8fafc; color: #475569; direction: rtl; }
              .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 500px; margin: auto; border: 1px solid #e2e8f0; }
              h1 { color: #0284c7; font-size: 20px; }
              p { font-size: 14px; line-height: 1.6; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>لا توجد بطاقات صيانة</h1>
              <p>لا توجد بطاقات صيانة مكتملة لشهر <strong>${targetMonth}</strong> في النظام حالياً لتصديرها.</p>
            </div>
          </body>
        </html>
      `);
    }

    // Sort completed cards by serial/ID
    completed.sort((a, b) => a.id.localeCompare(b.id));

    const getMonthArabicName = (dateStr: string) => {
      const parts = dateStr.split("-");
      const year = parts[0];
      const month = parts[1];
      const months: Record<string, string> = {
        "01": "يناير (كانون الثاني)",
        "02": "فبراير (شباط)",
        "03": "مارس (آذار)",
        "04": "أبريل (نيسان)",
        "05": "مايو (أيار)",
        "06": "يونيو (حزيران)",
        "07": "يوليو (تموز)",
        "08": "أغسطس (آب)",
        "09": "سبتمبر (أيلول)",
        "10": "أكتوبر (تشرين الأول)",
        "11": "نوفمبر (تشرين الثاني)",
        "12": "ديسمبر (كانون الأول)"
      };
      return `${months[month] || month} ${year}`;
    };

    const monthLabel = getMonthArabicName(targetMonth);
    const totalCards = completed.length;
    const uniqueVehicles = new Set(completed.map(c => c.vehicle_id).filter(Boolean)).size;
    const uniqueDrivers = new Set(completed.map(c => c.driver_name).filter(Boolean)).size;

    const tableRows = completed.map(c => {
      const vehicleText = c.vehicle_id ? `شاحنة: ${c.vehicle_id}` : `مقطورة: ${c.trailer_id || '—'}`;
      const exitDate = c.date_out ? c.date_out.substring(0, 10) : (c.date_in ? c.date_in.substring(0, 10) : '—');
      return `
        <tr>
          <td style="font-weight: bold; color: #1e3a8a;">
            ${c.id}
            ${c.work_team ? `<br/><span style="font-size: 10px; color: #64748b; font-weight: normal;">(${c.work_team})</span>` : ""}
          </td>
          <td><strong>${vehicleText}</strong></td>
          <td>${c.driver_name || '—'}</td>
          <td style="font-size: 11px;">
            <strong>${c.damage_type || '—'}</strong>
            ${c.diagnosis ? `<br/><span style="font-size: 10px; color: #475569; font-style: italic;">تشخيص: ${c.diagnosis}</span>` : ""}
          </td>
          <td>${parseRepairsHTML(c.repair_details)}</td>
          <td style="font-size: 10.5px; color: #334155;">${parsePartsHTMLLocal(c.parts)}</td>
          <td style="font-size: 11px; white-space: nowrap;">${exitDate}</td>
        </tr>
      `;
    }).join("");

    const monthlyTemplate = config.monthly_report_template || DEFAULT_MONTHLY_REPORT_TEMPLATE;

    const tokensMonthly = {
      month_label: monthLabel,
      print_date: new Date().toLocaleDateString('ar-SA'),
      report_ref: `M-RPT-${targetMonth.replace(/-/g, "")}`,
      total_cards: String(totalCards),
      unique_vehicles: String(uniqueVehicles),
      unique_drivers: String(uniqueDrivers),
      table_rows: tableRows,
      rendered_sheets: "" // Remove raw unstyled card dumping
    };

    let fullHtml = monthlyTemplate;
    Object.entries(tokensMonthly).forEach(([key, val]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      fullHtml = fullHtml.replace(regex, val);
    });

    // Strip legacy footer note about trailing sheets if present in custom saved templates
    fullHtml = fullHtml.replace(/<div[^>]*>\s*\*?\s*يتبع هذا الملخص التفاصيل الفنية[\s\S]*?<\/div>/gi, "");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(fullHtml);
  });

  // API - Render Daily Report for printing / export
  app.get("/api/reports/daily/render", (req, res) => {
    const config = loadConfig();
    const cards = loadDatabase(config.db_path);
    const targetDate = req.query.date ? String(req.query.date).substring(0, 10) : new Date().toISOString().substring(0, 10);

    // Filter cards active on the target day
    const dailyCards = cards.filter(c => {
      const dateInStr = c.date_in ? c.date_in.substring(0, 10) : "";
      const dateOutStr = c.date_out ? c.date_out.substring(0, 10) : "";
      return dateInStr === targetDate || dateOutStr === targetDate;
    });

    if (dailyCards.length === 0) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
          <head>
            <meta charset="utf-8">
            <title>تقرير الصيانة اليومي - لا توجد بيانات</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 50px; background-color: #f8fafc; color: #475569; direction: rtl; }
              .card { background: white; padding: 35px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); max-width: 500px; margin: auto; border: 1px solid #e2e8f0; }
              h1 { color: #2563eb; font-size: 20px; font-weight: 800; margin-bottom: 12px; }
              p { font-size: 14px; line-height: 1.6; }
              .date-selector { margin-top: 20px; font-size: 13px; color: #64748b; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>تقرير حركة الصيانة والورشة اليومي</h1>
              <p>لا توجد أي بطاقات صيانة مسجلة أو مكتملة في تاريخ <strong>${targetDate}</strong> بمجال قاعدة البيانات الحالية.</p>
              <div class="date-selector">
                يرجى العودة واختيار يوم آخر يحتوي على حركة تشغيل نشطة.
              </div>
            </div>
          </body>
        </html>
      `);
    }

    const dateMatchesISODate = (dateStr?: string, targetIso?: string) => {
      if (!dateStr || !targetIso) return false;
      if (dateStr.substring(0, 10) === targetIso) return true;
      const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) {
        const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        return iso === targetIso;
      }
      return false;
    };

    const totalActive = dailyCards.length;
    const newCheckins = dailyCards.filter(c => dateMatchesISODate(c.date_in, targetDate)).length;
    const completedToday = dailyCards.filter(c => dateMatchesISODate(c.date_out, targetDate) && c.status === "completed").length;
    const inProgressToday = dailyCards.filter(c => c.status !== "completed").length;

    const formatTimeOnly = (dateStr?: string) => {
      if (!dateStr) return "—";
      const tIndex = dateStr.indexOf("T");
      if (tIndex !== -1) {
        return dateStr.substring(tIndex + 1);
      }
      return dateStr;
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case "check_in": return "بانتظار الفحص";
        case "maintenance": return "قيد الصيانة";
        case "completed": return "منتهية وجاهزة";
        default: return status;
      }
    };

    const targetDateFormatted = new Date(targetDate).toLocaleDateString('ar-SA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const tableRows = dailyCards.map(c => {
      const vehicleText = c.vehicle_id ? `شاحنة: ${c.vehicle_id}` : `مقطورة: ${c.trailer_id || '—'}`;
      const isCheckinToday = dateMatchesISODate(c.date_in, targetDate);
      const isCheckoutToday = dateMatchesISODate(c.date_out, targetDate);
      
      let checkText = "";
      if (isCheckinToday) checkText += ` <span style="display:block; font-size:9px; color: #3b82f6; font-weight:bold;">🕒 دخول: ${formatTimeOnly(c.date_in)}</span>`;
      if (isCheckoutToday) checkText += ` <span style="display:block; font-size:9px; color: #10b981; font-weight:bold;">🕒 خروج: ${formatTimeOnly(c.date_out)}</span>`;

      return `
        <tr>
          <td style="font-weight: bold; color: #1e3a8a;">${c.id}${checkText}</td>
          <td>
            <strong>${vehicleText}</strong>
            ${c.work_team ? `<br/><span style="font-size: 10px; color: #64748b;">(فريق: ${c.work_team})</span>` : ""}
          </td>
          <td>${c.driver_name || '—'}</td>
          <td style="font-size: 11px;">
            <strong>${c.damage_type || '—'}</strong>
            ${c.diagnosis ? `<br/><span style="font-size: 10.5px; color: #475569; font-style: italic;">تشخيص: ${c.diagnosis}</span>` : ""}
          </td>
          <td>${parseRepairsHTML(c.repair_details)}</td>
          <td style="font-size:10.5px; color: #334155;">${parsePartsHTMLLocal(c.parts)}</td>
          <td>
            <span class="badge badge-${c.status}">${getStatusText(c.status)}</span>
          </td>
        </tr>
      `;
    }).join("");

    const dailyTemplate = config.daily_report_template || DEFAULT_DAILY_REPORT_TEMPLATE;

    const tokensDaily = {
      target_date_formatted: targetDateFormatted,
      target_date: targetDate,
      print_date: new Date().toLocaleDateString('ar-SA'),
      print_time: new Date().toLocaleTimeString('ar-SA'),
      report_ref: `RPT-${targetDate.replace(/-/g, "")}`,
      total_active: String(totalActive),
      new_checkins: String(newCheckins),
      completed_today: String(completedToday),
      in_progress_today: String(inProgressToday),
      table_rows: tableRows
    };

    let fullHtml = dailyTemplate;
    Object.entries(tokensDaily).forEach(([key, val]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      fullHtml = fullHtml.replace(regex, val);
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(fullHtml);
  });

  // API - Render HTML Template for printing / export
  app.get("/api/cards/:id/render", (req, res) => {
    const config = loadConfig();
    const cards = loadDatabase(config.db_path);
    const card = cards.find(c => c.id === req.params.id);

    if (!card) {
      return res.status(404).send("<h1>البطاقة غير موجودة</h1>");
    }

    let html = config.html_template;
    
    // Format repair details beautifully if they are JSON structured, or else keep as is
    let processedRepairDetailsHTML = card.repair_details || "—";
    if (processedRepairDetailsHTML.trim() === "[]") processedRepairDetailsHTML = "—";
    try {
      if (card.repair_details && card.repair_details.trim().startsWith("[")) {
        const parsed = JSON.parse(card.repair_details);
        if (Array.isArray(parsed)) {
          if (parsed.length === 0) {
            processedRepairDetailsHTML = "—";
          } else {
            processedRepairDetailsHTML = `<ol style="margin: 0; padding-right: 15px; text-align: right; direction: rtl; font-family: inherit; line-height: 1.4;">` +
              parsed.map((item: any) => {
                const desc = item.description || item.action || "—";
                const workersStr = Array.isArray(item.workers) && item.workers.length > 0 
                  ? ` <span style="font-size: 11px; color: #4a5568; font-weight: normal;">(الفنيين: ${item.workers.join("، ")})</span>`
                  : "";
                return `<li style="margin-bottom: 6px;"><strong>${desc}</strong>${workersStr}</li>`;
              }).join("") +
              `</ol>`;
          }
        }
      }
    } catch (e) {
      // ignore and use raw string
    }

    // Replace tokens
    const formatPrintDate = (str?: string) => str ? str.replace("T", " ") : "";

    const tokens = {
      id: card.id || "",
      vehicle_id: card.vehicle_id || "",
      driver_name: card.driver_name || "",
      trailer_id: card.trailer_id || "—",
      damage_type: card.damage_type || "—",
      date_in: formatPrintDate(card.date_in),
      date_out: card.date_out ? formatPrintDate(card.date_out) : "تحت الصيانة",
      diagnosis: card.diagnosis || "—",
      repair_details: processedRepairDetailsHTML,
      parts: formatPartsHTML(card.parts),
      work_team: card.work_team || "—",
      worker_name: card.worker_name || "—",
      signature_mechanic: card.signature_mechanic || "لم يوقع",
      signature_electrician: card.signature_electrician || "لم يوقع",
      signature_manager: card.signature_manager || "لم يوقع"
    };

    Object.entries(tokens).forEach(([key, val]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      html = html.replace(regex, val);
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
