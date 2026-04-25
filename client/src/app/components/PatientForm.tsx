import { useState } from "react";
import { Hash, X } from "lucide-react";
import { supabase } from "../../lib/supabase";

export interface PatientFormProps {
  open: boolean;
  onClose: () => void;
  onCreated: (patientId: string) => void;
}

export function PatientForm({ open, onClose, onCreated }: PatientFormProps) {
  const [caseId, setCaseId] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState<"" | "male" | "female">("");
  const [language, setLanguage] = useState("he");
  const [dominantHand, setDominantHand] = useState<"" | "right" | "left" | "ambidextrous">("");
  const [educationYears, setEducationYears] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const reset = () => {
    setCaseId("");
    setPhone("");
    setBirthDay("");
    setBirthMonth("");
    setBirthYear("");
    setGender("");
    setLanguage("he");
    setDominantHand("");
    setEducationYears("");
    setError(null);
  };

  const normalizedCaseId = caseId.trim().toUpperCase();

  const buildBirthDate = () => {
    const day = Number(birthDay);
    const month = Number(birthMonth);
    const year = Number(birthYear);
    if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
      return null;
    }
    if (year < 1900 || year > new Date().getFullYear() || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!normalizedCaseId) {
      setError("יש למלא מזהה תיק.");
      return;
    }
    if (!/^[A-Z0-9][A-Z0-9_.-]{2,49}$/.test(normalizedCaseId)) {
      setError("מזהה תיק חייב להיות קוד באנגלית/מספרים בלבד, 3-50 תווים.");
      return;
    }

    const normalizedPhone = phone.replace(/[\s-]/g, "");
    if (!/^\+?[0-9]{7,15}$/.test(normalizedPhone)) {
      setError("יש להזין מספר טלפון תקין.");
      return;
    }

    const dateOfBirth = buildBirthDate();
    if (!dateOfBirth) {
      setError("יש להזין תאריך לידה תקין.");
      return;
    }

    if (!gender) {
      setError("יש לבחור מין.");
      return;
    }
    if (language !== "he") {
      setError("בשלב זה נתמכת עברית בלבד.");
      return;
    }
    if (!dominantHand) {
      setError("יש לבחור יד דומיננטית.");
      return;
    }

    const education = Number(educationYears);
    if (!Number.isInteger(education) || education < 0 || education > 40) {
      setError("שנות לימוד חייבות להיות בין 0 ל-40.");
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
          case_id: normalizedCaseId,
          full_name: normalizedCaseId,
          phone: normalizedPhone,
          date_of_birth: dateOfBirth,
          gender,
          language,
          dominant_hand: dominantHand,
          education_years: education,
          id_number: null,
          notes: null,
        })
        .select("id")
        .single();

      if (insertError || !data) {
        throw new Error(insertError?.message ?? "פתיחת תיק נכשלה.");
      }

      reset();
      onCreated(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "פתיחת תיק נכשלה.");
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
        className="w-full max-w-xl bg-white rounded-3xl shadow-xl border border-gray-200 p-8 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center">
              <Hash className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-black">פתיחת תיק חדש</h2>
              <p className="text-gray-500 text-sm">פרטי רקע קליניים נשמרים לתיק ולפענוח המבדק</p>
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
            <label className="block text-sm font-bold text-gray-600 mb-1">מזהה תיק*</label>
            <input
              value={caseId}
              onChange={(e) => setCaseId(e.target.value.toUpperCase())}
              placeholder="למשל CASE-20260425-001"
              className="w-full h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none"
            />
            <p className="mt-1 text-xs text-gray-500">קוד פסאודונימי בלבד: אותיות באנגלית, מספרים, נקודה, מקף או קו תחתון.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">טלפון*</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="למשל 0501234567"
              inputMode="tel"
              className="w-full h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">תאריך לידה*</label>
            <div className="grid grid-cols-3 gap-3">
              <input
                value={birthDay}
                onChange={(e) => setBirthDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="יום"
                inputMode="numeric"
                className="h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none"
              />
              <input
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="חודש"
                inputMode="numeric"
                className="h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none"
              />
              <input
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="שנה"
                inputMode="numeric"
                className="h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">מין*</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as "" | "male" | "female")}
                aria-label="מין*"
                className="w-full h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none bg-white"
              >
                <option value="">בחרו</option>
                <option value="male">זכר</option>
                <option value="female">נקבה</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">שפת המבדק*</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                aria-label="שפת המבדק*"
                className="w-full h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none bg-white"
              >
                <option value="he">עברית</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">יד דומיננטית*</label>
              <select
                value={dominantHand}
                onChange={(e) => setDominantHand(e.target.value as "" | "right" | "left" | "ambidextrous")}
                aria-label="יד דומיננטית*"
                className="w-full h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none bg-white"
              >
                <option value="">בחרו</option>
                <option value="right">ימין</option>
                <option value="left">שמאל</option>
                <option value="ambidextrous">שתי הידיים</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-600 mb-1">שנות לימוד*</label>
              <input
                value={educationYears}
                onChange={(e) => setEducationYears(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="למשל 12"
                inputMode="numeric"
                className="w-full h-12 px-4 text-lg border-2 border-gray-300 rounded-xl focus:border-black focus:ring-4 focus:ring-black/10 outline-none"
              />
            </div>
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
              {saving ? "שומר..." : "פתח תיק"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
