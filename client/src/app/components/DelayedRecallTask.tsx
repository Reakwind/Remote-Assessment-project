import { SimpleTask } from "./SimpleTask";

export function DelayedRecallTask() {
  return (
    <SimpleTask 
      stepNumber={11}
      stepTitle="שליפה מאוחרת"
      mainTitle="האם אתה זוכר את המילים?"
      audioText="כעת, חזור על חמשת המילים שביקשתי ממך לזכור בתחילת המבדק."
      taskId="delayedRecall"
      description={
        <div>
          אמור בקול רם את כל 5 המילים שביקשנו ממך לזכור קודם לכן. 
          <br />
          (במידה ויש צורך, יושמעו לך רמזים).
          <br /><br />
          לחץ על התחל הקלטה ומנה את המילים שאתה זוכר.
        </div>
      }
    />
  );
}
