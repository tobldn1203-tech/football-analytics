import { runFplIngestion } from "@/lib/ingestion/fpl/runIngestion";

runFplIngestion()
  .then((summary) => {
    console.log("Ingestion complete:", summary);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Ingestion failed:", err);
    process.exit(1);
  });
