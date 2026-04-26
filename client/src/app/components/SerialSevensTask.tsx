import { SimpleTask } from "./SimpleTask";

export function SerialSevensTask() {
  return (
    <SimpleTask 
      stepNumber={8}
      stepTitle="חיסור 7"
      mainTitle="חיסור עוקב של 7 מ-100"
      audioText="התחל מ-100 והחסר בכל פעם 7 עד סוף ההקלטה."
      taskId="serial7"
      description={
        <div>
          החסר 7 מ-100, ולאחר מכן החסר שוב 7 מהמספר שקיבלת,
          <br />וכן הלאה. לדוגמה, אם מתחילים מ-21: 14, 7.
          <br /><br />
          אמור את התשובות בקול רם. המערכת תקליט אותך.
        </div>
      }
    />
  );
}
