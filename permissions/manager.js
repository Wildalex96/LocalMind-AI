class PermissionManager {
  constructor(policy){this.policy=policy;this.pending=new Map();this.sequence=0;}
  request(capability,details={}){const decision=this.policy.get(capability);if(decision==="allow")return{status:"allowed",capability};if(decision==="deny")return{status:"denied",capability};const id=`perm-${++this.sequence}`;const request={id,capability,details,status:"pending",createdAt:new Date().toISOString()};this.pending.set(id,request);return request;}
  decide(id,approved){const request=this.pending.get(id);if(!request)throw new Error("Unknown permission request");request.status=approved?"allowed":"denied";request.decidedAt=new Date().toISOString();this.pending.delete(id);return request;}
  listPending(){return[...this.pending.values()];}
}
module.exports={PermissionManager};
