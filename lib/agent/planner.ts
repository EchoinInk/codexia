import {
AgentContext
}
from "./types";


export interface Plan {

goal:string;

steps:string[];

files:string[];

}


export async function createPlan(
context:AgentContext
):Promise<Plan>{


return {

goal:
context.messages[
context.messages.length-1
].content,


steps:[
"Analyze request",
"Find required files",
"Make changes",
"Verify"
],


files:[]

};


}