import { SimpleTask } from "./SimpleTask";

export function OrientationTask() {
  return (
    <SimpleTask 
      stepNumber={12}
      stepTitle="התמצאות"
      mainTitle="התמצאות בזמן ובמקום"
      audioText="ספר לי בבקשה מהו התאריך המלא היום, ובאיזה מקום אנחנו נמצאים."
      taskId="orientation"
      description={
        <div className="flex w-full flex-col items-center gap-4 sm:gap-6">
          לחץ על התחל הקלטה, וענה על השאלות הבאות בקול רם:
          <div className="mt-2 grid w-full max-w-lg grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-white p-4 text-right text-base shadow-sm sm:mt-4 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-4 sm:p-6 sm:text-lg">
             <div className="border-b border-gray-200 pb-2 font-bold">יום בחודש</div>
             <div className="border-b border-gray-200 pb-2 font-bold">חודש</div>
             <div className="border-b border-gray-200 pb-2 font-bold">שנה</div>
             <div className="border-b border-gray-200 pb-2 font-bold">יום בשבוע</div>
             <div className="font-bold">מקום/מוסד</div>
             <div className="font-bold">עיר</div>
          </div>
        </div>
      }
    />
  );
}
