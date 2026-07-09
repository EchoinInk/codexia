import {
  toolRegistry
} from "./registry";


import {
  readFileTool,
  writeFileTool,
  listFilesTool,
  deleteFileTool
} from "./filesystem";


import {
  extractToolCall
} from "./tools-parser";



toolRegistry.register(
  readFileTool
);


toolRegistry.register(
  writeFileTool
);


toolRegistry.register(
  listFilesTool
);


toolRegistry.register(
  deleteFileTool
);



export {
  toolRegistry,
  extractToolCall
};