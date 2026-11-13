// Development entry point; never deploy this worker.
import { createWorker } from "./index";
export default createWorker(true);
