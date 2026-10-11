/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PartItem {
  id: string;
  name: string;
  date: string; // yyyy-mm-dd
  target?: 'vehicle' | 'trailer'; // Specify if it is for the vehicle or the trailer
}

export interface MaintenanceCard {
  id: string; // Serial number, e.g. "MV-2026-0001"
  vehicle_id: string; // Required
  driver_name: string; // Required
  trailer_id?: string; // Optional
  damage_type?: string; // Optional (description)
  date_in: string; // Check-in date (yyyy-mm-dd)
  date_out?: string; // Check-out date (yyyy-mm-dd)
  status: 'check_in' | 'maintenance' | 'completed';
  destination?: 'workshop' | 'parking'; // Target location (Workshop vs Parking Lot)
  transferred_to_workshop_at?: string; // Timestamp when transferred from parking to workshop
  
  // Maintenance Details
  diagnosis?: string; // Mechanic diagnosis
  repair_details?: string; // Repair details
  parts?: string; // Replaced parts description or list
  work_team?: string; // Work crew / team
  worker_name?: string; // Technician/Worker who performed repair

  // Signatures
  signature_mechanic?: string; // Name or confirmation
  signature_electrician?: string; // Name or confirmation
  signature_manager?: string; // Name or confirmation
}

export interface AppConfig {
  db_path: string;
  html_template: string;
  daily_report_template?: string;
  monthly_report_template?: string;
  default_vehicles: string[];
  default_drivers: string[];
  default_work_teams: string[];
  default_workers: string[];
  driver_phones?: Record<string, string>;
  worker_phones?: Record<string, string>;
}
