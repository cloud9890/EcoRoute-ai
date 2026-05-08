import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';
export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'src/**/*', '*.ts', '*.json'] 
  },
  firebaseRulesPlugin.configs['flat/recommended']
]
