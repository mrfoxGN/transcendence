export const sampleProject: { workspace: string; taskId: string; taskTitle: string } = {
  workspace: 'Studio North', taskId: 'DEV-12', taskTitle: 'Build login page',
};
export const sampleRepository: { name: string; branches: string[]; commits: { title: string; sha: string }[] } = {
 name: 'studio-north / storefront', branches: ['main', 'feat/login'],
 commits: [{ title: 'Add workspace navigation', sha: 'e7b13a2' }, { title: 'Define task status labels', sha: '68cc2e9' }, { title: 'Polish login form states', sha: '2fb840d' }],
};
