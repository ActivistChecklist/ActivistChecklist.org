<?php
/**
 * Copy to deploy.local.php beside deploy.php on the server (not committed).
 * chmod 640 deploy.local.php && chown root:www-data (or owner + PHP-FPM group).
 *
 * deploy.php finds the repo as the parent of public/ (expects …/repo/public/webhooks/deploy.php).
 * It runs scripts/build_deploy.sh in that repo unless you override below.
 */

declare(strict_types=1);

return [
  // GitHub webhook "Secret" — use: openssl rand -hex 32
  'secret' => 'CHANGE_ME_LONG_RANDOM',

  // Optional: require this exact repo (stops stray webhooks if URL leaks).
  // This is the GitHub "full_name" field, NOT a URL.
  // Example: 'ActivistChecklist/ActivistChecklist.org'
  'allowed_repository' => 'ActivistChecklist/ActivistChecklist.org',

  'allowed_ref' => 'refs/heads/main',

  // Required in practice: pass env into scripts/build_deploy.sh (PHP often runs as www-data).
  // DEPLOY_TARGET — absolute path to the web docroot where `out/` is rsynced (your live site files).
  // HOME — user whose ~/.ssh and permissions match the git remote (often same as repo owner).
  'deploy_env' => [
    'DEPLOY_TARGET' => '/var/www/html',
    'HOME' => '/home/YOURUSER',
  ],

  // Optional: only if checkout path is not …/repo/public/webhooks (unusual symlink layouts)
  // 'repo_root' => '/home/you/include/ActivistChecklist.org',

  // Optional: custom script path (must still live under script_parent_dir / repo root)
  // 'deploy_script' => '/custom/path/scripts/build_deploy.sh',
  // 'script_parent_dir' => '/custom/path',

  // Logging is on by default: repo root .deploy-webhook.log (gitignored). Override path:
  // 'log_file' => '/var/log/activistchecklist-deploy-webhook.log',
  // Or disable with: 
  // 'log_file' => false,
];
