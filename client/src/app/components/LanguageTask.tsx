import { SimpleTask } from "./SimpleTask";

export function LanguageTask() {
  return (
    <SimpleTask 
      stepNumber={9}
      stepTitle="שפה"
      mainTitle="חזרה על משפטים ושטף מילולי"
      audioText="אקריא לך שני משפטים, חזור אחריהם במדויק. לאחר מכן אבקש ממך למנות מילים שמתחילות באות מסוימת."
      taskId="language"
      description={
        <div>
          ראשית, חזור בקול רם על שני המשפטים שתשמע.
          <br /><br />
          לאחר מכן, תתבקש למנות כמה שיותר מילים המתחילות באות מסוימת, במשך דקה אחת.
          <br /><br />
          לחץ על התחל הקלטה והשאר את ההקלטה פעילה עד שסיימת את כל החלקים.
        </div>
      }
    />
  );
}
