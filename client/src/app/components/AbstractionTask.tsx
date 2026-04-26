import { SimpleTask } from "./SimpleTask";

export function AbstractionTask() {
  return (
    <SimpleTask 
      stepNumber={10}
      stepTitle="הפשטה"
      mainTitle="מה הקשר בין המילים הבאות?"
      audioText="ספר לי מה המשותף בין המילים הבאות שתשמע, למשל 'בננה ותפוז הם פירות'."
      taskId="abstraction"
      description={
        <div>
          למשל: תפוז ובננה הם פירות.
          <br /><br />
          מה משותף לרכבת ולאופניים?
          <br />
          מה משותף לשעון ולסרגל?
          <br /><br />
          ענה על השאלות בקול רם בזמן ההקלטה.
        </div>
      }
    />
  );
}
