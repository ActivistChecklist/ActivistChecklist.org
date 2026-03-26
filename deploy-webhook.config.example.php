<?php
/**
 * GitHub deploy webhook — configuration (example).
 *
 * On the server, copy to deploy-webhook.config.local.php in the repo root (not committed).
 *   cp deploy-webhook.config.example.php deploy-webhook.config.local.php
 *   chmod 640 deploy-webhook.config.local.php
 *   chown root:www-data (or owner + PHP-FPM group)
 *
 * public/webhooks/deploy.php loads deploy-webhook.config.local.php from the project root.
 */

declare(strict_types=1);

return [
  // GitHub webhook "Secret" — use: openssl rand -hex 32
  'secret' => 'CHANGE_ME_LONG_RANDOM',

  // Absolute path to this git checkout on the server (required).
  'repo_root' => '/var/www/activistchecklist.org',

  // Optional: require this exact repo (stops stray webhooks if URL leaks).
  // This is the GitHub "full_name" field, NOT a URL.
  // Example: 'ActivistChecklist/ActivistChecklist.org'
  'allowed_repository' => 'ActivistChecklist/ActivistChecklist.org',

  'allowed_ref' => 'refs/heads/main',

  // Passed into scripts/build_deploy.sh (PHP often runs as www-data).
  // Do not set REPO_DIR here — deploy.php sets it from repo_root above.
  // DEPLOY_TARGET — absolute path to the web docroot where `out/` is rsynced.
  // HOME — user whose ~/.ssh matches the git remote (if different from PHP's user).
  'deploy_env' => [
    'DEPLOY_TARGET' => '/var/www/html',
    'HOME' => '/home/YOURUSER',
  ],

  // Optional: custom script path (must still live under script_parent_dir / repo root)
  // 'deploy_script' => '/custom/path/scripts/build_deploy.sh',
  // 'script_parent_dir' => '/custom/path',

  // Logging is on by default: repo root .deploy-webhook.log (gitignored). Override path:
  // 'log_file' => '/var/log/activistchecklist-deploy-webhook.log',
  // Or disable with:
  // 'log_file' => false,
];
