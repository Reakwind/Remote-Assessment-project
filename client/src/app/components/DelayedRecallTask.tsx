import { SimpleTask } from "./SimpleTask";

export function DelayedRecallTask() {
  return (
    <SimpleTask 
      stepNumber={11}
      stepTitle="שליפה מושהית"
      mainTitle="האם אתה זוכר את המילים?"
      audioText="כעת, חזור על חמשת המילים שביקשתי ממך לזכור בתחילת המבדק."
      taskId="delayedRecall"
      description={
        <div>
          אמור בקול רם את כל 5 המילים שביקשתי ממך לזכור קודם לכן.
          <br /><br />
          לחץ על התחל הקלטה ומנה את המילים שאתה זוכר.
        </div>
      }
    />
  );
}
