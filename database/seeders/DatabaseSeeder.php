<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Task;
use App\Models\Shift;
use App\Models\Announcement;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Create manager
        $manager = User::create([
            'name'        => 'Warehouse Manager',
            'email'       => 'manager@warehouse.com',
            'password'    => Hash::make('password'),
            'role'        => 'management',
            'employee_id' => 'MGR001',
            'department'  => 'Management',
            'phone'       => '0771234567',
            'is_active'   => true,
        ]);

        // Create workers
        $worker1 = User::create([
            'name'        => 'John Silva',
            'email'       => 'john@warehouse.com',
            'password'    => Hash::make('password'),
            'role'        => 'worker',
            'employee_id' => 'WRK001',
            'department'  => 'Receiving',
            'phone'       => '0779876543',
            'is_active'   => true,
        ]);

        $worker2 = User::create([
            'name'        => 'Priya Fernando',
            'email'       => 'priya@warehouse.com',
            'password'    => Hash::make('password'),
            'role'        => 'worker',
            'employee_id' => 'WRK002',
            'department'  => 'Dispatch',
            'phone'       => '0771112222',
            'is_active'   => true,
        ]);

        // Create tasks
        Task::create([
            'title'       => 'Unload Container A12',
            'description' => 'Unload and sort all items from container A12',
            'assigned_to' => $worker1->id,
            'assigned_by' => $manager->id,
            'status'      => 'pending',
            'priority'    => 'high',
            'location'    => 'Bay 3 - Zone A',
            'due_date'    => now()->addHours(4),
        ]);

        Task::create([
            'title'       => 'Stock Shelves - Row 5',
            'description' => 'Restock items on Row 5 from yesterday delivery',
            'assigned_to' => $worker2->id,
            'assigned_by' => $manager->id,
            'status'      => 'in_progress',
            'priority'    => 'medium',
            'location'    => 'Row 5',
            'due_date'    => now()->addHours(2),
        ]);

        // Create shifts
        Shift::create([
            'user_id'    => $worker1->id,
            'shift_name' => 'Morning Shift',
            'start_time' => '06:00:00',
            'end_time'   => '14:00:00',
            'date'       => today(),
        ]);

        Shift::create([
            'user_id'    => $worker2->id,
            'shift_name' => 'Afternoon Shift',
            'start_time' => '14:00:00',
            'end_time'   => '22:00:00',
            'date'       => today(),
        ]);

        // Create announcement
        Announcement::create([
            'title'      => 'Safety Reminder',
            'body'       => 'Please wear safety boots in all warehouse zones at all times.',
            'created_by' => $manager->id,
            'target'     => 'all',
        ]);
    }
}