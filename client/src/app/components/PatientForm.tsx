import { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { supabase } from "../../lib/supabase";

export interface PatientFormProps {
  open: boolean;
  onClose: () => void;
  onCreated: (patientId: string) => void;
}

export function PatientForm({ open, onClose, onCreated }: PatientFormProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const reset = () => {
    setFullName("");
    setPhone("");
    setDateOfBirth("");
    setIdNumber("");
    setNotes("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone) {
      setError("יש למלא שם מלא ומספר טלפון.");
      return;
    }

    const { data: authData } = await supabase.auth.getSession();
    const session = authData.session;
    if (!session) {
      setError("יש להתחבר מחדש.");
      return;
    }

    setSaving(true);
    try {
      const { data, error: insertError } = await supabase
        .from("patients")
        .insert({
          clinician_id: session.user.id,
          full_name: trimmedName,
          phone: trimmedPhone,
          date_of_birth: dateOfBirth || null,
          id_number: idNumber.trim() || null,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (insertError || !data) {
        throw new Error(insertError?.message ?? "הוספת מטופל נכשלה.");
      }

      reset();
      onCreated(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "הוספת מטופל נכשלה.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6 font-['Heebo',sans-serif]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-3xl shadow-xl border border-gray-200 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-black">הוספת מטופל חדש</h2>
              <p className="text-gray-500 text-sm">פרטי המטופל נשמרים לפרופיל קבוע</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">שם מלא*</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="למשל ישראל ישראלי"
              className="w-full h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">טלפון*</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+972501234567"
                inputMode="tel"
                className="w-full h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">תאריך לידה</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">תעודת זהות</label>
            <input
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="9 ספרות"
              inputMode="numeric"
              className="w-full h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">הערות קליניות</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="לדוגמה: הפניה ממרפאה לגריאטריה, רקע רפואי משמעותי"
              className="w-full p-3 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 font-bold">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-14 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-50"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-14 rounded-xl bg-black text-white font-bold hover:bg-gray-800 disabled:opacity-60"
            >
              {saving ? "שומר..." : "הוסף מטופל"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
