import {
AgentContext
}
from "./types";


export function createContext(
messages:any[],
workspace:string
):AgentContext{


return {

messages,

workspace,

filesRead:[],

filesModified:[]

};

}
