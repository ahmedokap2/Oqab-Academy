import{recordPublicVisit,watchPublicMetrics,getSiteSettings,getActiveClasses,studentLogin,restoreStudentProgress,restoreStudentSession,studentLogout,syncStudentProgress,changeStudentPassword}from'../cloud.js?v=20260913-teacher-reset';
window.learningCloud={studentLogin,restoreStudentProgress,studentLogout,syncStudentProgress,changeStudentPassword,status:'loading',settings:null,classes:[],session:null};
const visits=document.querySelector('#public-total-visits');
watchPublicMetrics(m=>{const n=Number(m.totalVisits);visits.textContent=Number.isFinite(n)?n.toLocaleString():'—';});
recordPublicVisit().catch(()=>{});
Promise.all([getSiteSettings(),getActiveClasses()]).then(async([settings,classes])=>{
  window.learningCloud.settings=settings;window.learningCloud.classes=classes;
  if(settings.accessMode==='restricted')window.learningCloud.session=await restoreStudentSession();
  window.learningCloud.status='ready';window.dispatchEvent(new CustomEvent('learning-cloud-ready'));
}).catch(()=>{window.learningCloud.status='error';window.dispatchEvent(new CustomEvent('learning-cloud-ready'));});
