package org.bfx.vesper

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.ContactsContract
import android.util.Log
import androidx.core.content.ContextCompat

object ContactLookupHelper {
    private const val TAG = "ContactLookupHelper"

    /**
     * Checks if the given phone number belongs to an existing contact saved on the device.
     *
     * @param context Application/Activity Context
     * @param phoneNumber The incoming caller's phone number
     * @return true if caller is found in saved contacts; false if unknown / outside contacts or private number
     */
    fun isSavedContact(context: Context, phoneNumber: String?): Boolean {
        if (phoneNumber.isNullOrBlank()) {
            Log.d(TAG, "Incoming number is null/empty/private -> Treating as unknown caller outside contacts.")
            return false
        }

        val cleanNumber = phoneNumber.trim()
        if (cleanNumber.equals("private", ignoreCase = true) ||
            cleanNumber.equals("unknown", ignoreCase = true) ||
            cleanNumber.equals("unavailable", ignoreCase = true) ||
            cleanNumber.equals("restricted", ignoreCase = true)) {
            Log.d(TAG, "Caller ID is hidden/private ($cleanNumber) -> Treating as unknown caller outside contacts.")
            return false
        }

        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "READ_CONTACTS permission not granted. Cannot verify contact -> Treating as outside contacts.")
            return false
        }

        // Method 1: Standard Android PhoneLookup with framework normalization
        try {
            val uri = Uri.withAppendedPath(
                ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                Uri.encode(cleanNumber)
            )
            val projection = arrayOf(
                ContactsContract.PhoneLookup._ID,
                ContactsContract.PhoneLookup.DISPLAY_NAME
            )
            context.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
                if (cursor.count > 0 && cursor.moveToFirst()) {
                    val nameIdx = cursor.getColumnIndex(ContactsContract.PhoneLookup.DISPLAY_NAME)
                    val name = if (nameIdx >= 0) cursor.getString(nameIdx) else "Saved Contact"
                    Log.i(TAG, "Caller '$cleanNumber' matched saved contact: '$name'")
                    return true
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "PhoneLookup query failed for '$cleanNumber': ${e.message}")
        }

        // Method 2: Fallback to last 10 digits for numbers with/without country codes (e.g. +91)
        val digitsOnly = cleanNumber.filter { it.isDigit() }
        if (digitsOnly.length >= 10) {
            val last10 = digitsOnly.takeLast(10)
            try {
                val fallbackUri = Uri.withAppendedPath(
                    ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                    Uri.encode(last10)
                )
                val projection = arrayOf(
                    ContactsContract.PhoneLookup._ID,
                    ContactsContract.PhoneLookup.DISPLAY_NAME
                )
                context.contentResolver.query(fallbackUri, projection, null, null, null)?.use { cursor ->
                    if (cursor.count > 0 && cursor.moveToFirst()) {
                        val nameIdx = cursor.getColumnIndex(ContactsContract.PhoneLookup.DISPLAY_NAME)
                        val name = if (nameIdx >= 0) cursor.getString(nameIdx) else "Saved Contact"
                        Log.i(TAG, "Caller '$cleanNumber' matched saved contact by last 10 digits ($last10): '$name'")
                        return true
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Last 10 digits PhoneLookup failed: ${e.message}")
            }

            // Method 3: Direct CommonDataKinds query matching last 10 digits
            try {
                val phoneUri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI
                val selection = "${ContactsContract.CommonDataKinds.Phone.NUMBER} LIKE ?"
                val selectionArgs = arrayOf("%$last10%")
                context.contentResolver.query(phoneUri, arrayOf(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME), selection, selectionArgs, null)?.use { cursor ->
                    if (cursor.count > 0) {
                        Log.i(TAG, "Caller '$cleanNumber' matched CommonDataKinds phone by suffix ($last10)")
                        return true
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "CommonDataKinds query failed: ${e.message}")
            }
        }

        Log.i(TAG, "Caller '$cleanNumber' was NOT found in contacts -> Unknown caller outside contacts.")
        return false
    }
}
