package com.example.pesoai.ui.authentication

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.example.pesoai.databinding.ActivityAuthBinding

class AuthActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAuthBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // REMOVED: Remember Me auto-login check — feature removed
        binding = ActivityAuthBinding.inflate(layoutInflater)
        setContentView(binding.root)
    }
}