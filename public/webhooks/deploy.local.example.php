<?php
/**
 * Copy to deploy.local.php beside deploy.php on the server (not committed).
 * chmod 640 && chown root:www-data (or owner + PHP-FPM group).
 */

declare(strict_types=1);

return [
  // GitHub webhook "Secret" — use: openssl rand -hex 32
  'secret' => 'CHANGE_ME_LONG_RANDOM',

  // Absolute path to the deploy script (must be executable: chmod 750)
  'deploy_script' => '/home/YOURUSER/include/build_deploy.sh',

  // deploy_script must resolve under this directory (prefix check)
  'script_parent_dir' => '/home/YOURUSER/include',

  // Optional: require this exact repo (stops stray webhooks if URL leaks)
  'allowed_repository' => 'YOURGITHUB/ActivistChecklist.org',

  'allowed_ref' => 'refs/heads/main',

  // If PHP runs as www-data, run deploy as your user (visudo example in deploy.php header):
  // 'deploy_command_prefix' => ['sudo', '-n', '-u', 'YOURUSER'],

  // If not using sudo, set HOME so ~/ paths in build_deploy.sh resolve correctly:
  // 'deploy_env' => ['HOME' => '/home/YOURUSER'],

  // Optional: append deploy logs (mode 600; ensure PHP user can write)
  // 'log_file' => '/home/YOURUSER/include/deploy-webhook.log',
];
