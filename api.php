<?php
/**
 * Cyber Neon Arcade - Central Database API
 * Connects to MariaDB/MySQL via local Unix domain socket.
 * Handles auto-bootstrapping, inserting records, and retrieving sorted leaderboards.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Preflight CORS response
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// ==========================================
// DB CONFIGURATION
// ==========================================
$db_host   = '';
$db_port   = 3306;
$db_user   = ''; // Change if custom user is required
$db_pass   = '';
$db_name   = 'cyber_arcade';

try {
    // 1. Connect using TCP host/port without database to allow auto-creation
    $dsn = "mysql:host={$db_host};port={$db_port};charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    
    $pdo = new PDO($dsn, $db_user, $db_pass, $options);
    
    // 2. Bootstrapping: Auto-create database & tables
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$db_name}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `{$db_name}`");
    
    // Create running_mouse table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `running_mouse` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `name` VARCHAR(50) NOT NULL,
        `score_ms` INT NOT NULL,
        `date_str` VARCHAR(20) NOT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Create number_puzzle table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `number_puzzle` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `name` VARCHAR(50) NOT NULL,
        `moves` INT NOT NULL,
        `date_str` VARCHAR(20) NOT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Create hover_escape table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `hover_escape` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `name` VARCHAR(50) NOT NULL,
        `distance` DOUBLE NOT NULL,
        `date_str` VARCHAR(20) NOT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed: ' . $e->getMessage()
    ]);
    exit;
}

// ==========================================
// REQUEST ROUTING
// ==========================================
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';
$game   = isset($_GET['game']) ? $_GET['game'] : '';

// Map valid games to their respective table names
$valid_games = [
    'running_mouse' => 'running_mouse',
    'number_puzzle' => 'number_puzzle',
    'hover_escape'  => 'hover_escape'
];

if ($method === 'GET') {
    // ------------------------------------------
    // ACTION: FETCH RANKINGS (GET)
    // ------------------------------------------
    if ($action === 'rankings') {
        if (!array_key_exists($game, $valid_games)) {
            echo json_encode(['success' => false, 'message' => 'Invalid game parameter.']);
            exit;
        }
        
        $table = $valid_games[$game];
        
        try {
            // Retrieve top 20 rankings based on game-specific rules
            if ($game === 'running_mouse') {
                // Sorted by time/score ascending (faster is better)
                $stmt = $pdo->query("SELECT `name`, `score_ms` AS `time`, `date_str` AS `date` FROM `{$table}` ORDER BY `score_ms` ASC LIMIT 20");
            } else if ($game === 'number_puzzle') {
                // Sorted by moves ascending (fewer moves is better)
                $stmt = $pdo->query("SELECT `name`, `moves`, `date_str` AS `date` FROM `{$table}` ORDER BY `moves` ASC LIMIT 20");
            } else if ($game === 'hover_escape') {
                // Sorted by distance descending (longer flight is better)
                $stmt = $pdo->query("SELECT `name`, `distance` AS `distanceVal`, `date_str` AS `date` FROM `{$table}` ORDER BY `distance` DESC LIMIT 20");
            }
            
            $rankings = $stmt->fetchAll();
            
            // Format dates or outputs on the fly if needed (letting frontend calculate layout)
            echo json_encode([
                'success' => true,
                'rankings' => $rankings
            ]);
            
        } catch (Exception $e) {
            echo json_encode([
                'success' => false,
                'message' => 'Error querying rankings: ' . $e->getMessage()
            ]);
        }
        exit;
    }
    
    // Default GET fallback
    echo json_encode(['success' => false, 'message' => 'Invalid GET action. Use action=rankings.']);
    exit;

} else if ($method === 'POST') {
    // ------------------------------------------
    // ACTION: SAVE SCORE (POST)
    // ------------------------------------------
    // Read JSON payload from post body
    $raw_input = file_get_contents('php://input');
    $input = json_decode($raw_input, true);
    
    if (!$input) {
        echo json_encode(['success' => false, 'message' => 'Invalid JSON input.']);
        exit;
    }
    
    $post_action = isset($input['action']) ? $input['action'] : '';
    $post_game   = isset($input['game']) ? $input['game'] : '';
    $name        = isset($input['name']) ? trim($input['name']) : '';
    $score       = isset($input['score']) ? $input['score'] : null;
    $date        = isset($input['date']) ? trim($input['date']) : '';
    
    if ($post_action !== 'save') {
        echo json_encode(['success' => false, 'message' => 'Invalid action in POST body.']);
        exit;
    }
    
    if (!array_key_exists($post_game, $valid_games)) {
        echo json_encode(['success' => false, 'message' => 'Invalid game parameter in POST body.']);
        exit;
    }
    
    if (empty($name)) {
        echo json_encode(['success' => false, 'message' => 'Player name is required.']);
        exit;
    }
    
    if ($score === null) {
        echo json_encode(['success' => false, 'message' => 'Game score is required.']);
        exit;
    }
    
    // Fallback date string if not provided
    if (empty($date)) {
        $date = date('y. m. d.'); // Format matches typical "26. 05. 29." Korean layout
    }
    
    $table = $valid_games[$post_game];
    
    try {
        if ($post_game === 'running_mouse') {
            $stmt = $pdo->prepare("INSERT INTO `{$table}` (`name`, `score_ms`, `date_str`) VALUES (:name, :score, :date_str)");
            $stmt->execute([
                ':name'     => strtoupper($name),
                ':score'    => (int)$score,
                ':date_str' => $date
            ]);
        } else if ($post_game === 'number_puzzle') {
            $stmt = $pdo->prepare("INSERT INTO `{$table}` (`name`, `moves`, `date_str`) VALUES (:name, :score, :date_str)");
            $stmt->execute([
                ':name'     => strtoupper($name),
                ':score'    => (int)$score,
                ':date_str' => $date
            ]);
        } else if ($post_game === 'hover_escape') {
            $stmt = $pdo->prepare("INSERT INTO `{$table}` (`name`, `distance`, `date_str`) VALUES (:name, :score, :date_str)");
            $stmt->execute([
                ':name'     => strtoupper($name),
                ':score'    => (double)$score,
                ':date_str' => $date
            ]);
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Record successfully secured in database.'
        ]);
        
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Error saving record: ' . $e->getMessage()
        ]);
    }
    exit;
}

// Invalid method fallback
echo json_encode(['success' => false, 'message' => 'Unsupported HTTP request method.']);
exit;
