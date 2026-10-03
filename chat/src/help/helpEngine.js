import { db, collection, getDocs, setDoc, doc, deleteDoc } from "../firebase.js";

export function initHelpEngine(currentUser) {
    const ownerEmail = 'akshat124.am12@gmail.com';
    const isOwner = currentUser && String(currentUser.email).toLowerCase().trim() === ownerEmail;

    // Element references
    const helpBtn = document.getElementById('navHelpBtn');
    const ownerBtn = document.getElementById('ownerPanelBtn');
    const helpModal = document.getElementById('helpModal');
    const ownerModal = document.getElementById('ownerModal');
    const helpForm = document.getElementById('helpForm');
    const complaintsList = document.getElementById('complaintsList');

    const closeHelpBtn = document.getElementById('closeHelpBtn');
    const cancelHelpBtn = document.getElementById('cancelHelpBtn');
    const closeOwnerBtn = document.getElementById('closeOwnerBtn');

    // --- VISIBILITY PERMISSIONS ---
    if (isOwner) {
        // OWNER: Show '?' nav button, hide user 'Help' nav button
        if (ownerBtn) ownerBtn.style.display = 'inline-block';
        if (helpBtn) helpBtn.style.display = 'none';

        if (ownerBtn) {
            ownerBtn.onclick = async (e) => {
                e.preventDefault();
                ownerModal.style.display = 'flex';
                await fetchAndRenderComplaints();
            };
        }
    } else {
        // REGULAR USER: Show 'Help' nav button, hide '?' nav button
        if (ownerBtn) ownerBtn.style.display = 'none';
        if (helpBtn) helpBtn.style.display = 'inline-block';

        if (helpBtn) {
            helpBtn.onclick = (e) => {
                e.preventDefault();
                helpModal.style.display = 'flex';
            };
        }
    }

    // --- MODAL CLOSE LOGIC ---
    const hideHelp = () => { if (helpModal) helpModal.style.display = 'none'; };
    const hideOwner = () => { if (ownerModal) ownerModal.style.display = 'none'; };

    if (closeHelpBtn) closeHelpBtn.onclick = hideHelp;
    if (cancelHelpBtn) cancelHelpBtn.onclick = hideHelp;
    if (closeOwnerBtn) closeOwnerBtn.onclick = hideOwner;

    window.addEventListener('click', (e) => {
        if (e.target === helpModal) hideHelp();
        if (e.target === ownerModal) hideOwner();
    });

    // --- SUBMISSION LOGIC ---
    if (helpForm) {
        helpForm.onsubmit = async (e) => {
            e.preventDefault();

            const subjectInput = document.getElementById('helpSubject');
            const detailsInput = document.getElementById('helpDetails');
            const submitBtn = document.getElementById('submitHelpBtn');

            const timestamp = Date.now();
            const ticketId = `ticket_${timestamp}`;

            const complaintPayload = {
                name: currentUser?.name || 'Anonymous User',
                email: currentUser?.email || 'No email provided',
                subject: subjectInput.value.trim(),
                details: detailsInput.value.trim(),
                date: timestamp,
                status: 'Unresolved'
            };

            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            try {
                await setDoc(doc(db, "help_complaints", ticketId), complaintPayload);
                alert('Your request has been submitted. The owner will review it shortly.');
                helpForm.reset();
                hideHelp();
            } catch (error) {
                console.error("Error submitting ticket:", error);
                alert("Failed to submit request: " + error.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Ticket';
            }
        };
    }

    // --- OWNER COMPLAINTS FETCH & DELETE LOGIC ---
    async function fetchAndRenderComplaints() {
        if (!complaintsList) return;
        complaintsList.innerHTML = '<p style="text-align:center; color:var(--text-muted, #888); font-size: 16px; padding:40px 0;">Loading secure database...</p>';

        try {
            const snapshot = await getDocs(collection(db, "help_complaints"));
            complaintsList.innerHTML = '';

            if (snapshot.empty) {
                complaintsList.innerHTML = '<p style="text-align:center; color:var(--text-muted, #888); font-size: 16px; padding:50px 0;">No complaints registered yet.</p>';
                return;
            }

            const complaints = [];
            snapshot.forEach(docSnap => {
                complaints.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Sort newest first
            complaints.sort((a, b) => (b.date || 0) - (a.date || 0));

            complaints.forEach((ticket) => {
                const displayDate = ticket.date ? new Date(ticket.date).toLocaleString() : 'Unknown date';
                const card = document.createElement('div');
                card.id = `card_${ticket.id}`;
                card.style.cssText = "background: var(--app-bg, #f9fafb); border: 1px solid var(--border, #e5e7eb); border-left: 5px solid #ea0038; border-radius: 10px; padding: 20px; display: flex; flex-direction: column; gap: 10px;";

                const safeSubject = String(ticket.subject || 'No Subject').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
                const safeName = String(ticket.name || 'User').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
                const safeEmail = String(ticket.email || 'No email').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
                const safeDetails = String(ticket.details || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:15px;">
                        <h4 style="margin:0; font-size:18px; font-weight:700; color:var(--text-main, #111); word-break:break-word;">${safeSubject}</h4>
                        <span style="font-size:13px; color:var(--text-muted, #888); white-space:nowrap;">${displayDate}</span>
                    </div>
                    <div style="font-size:14px; color:var(--text-muted, #666); border-bottom:1px solid var(--border, #eee); padding-bottom:10px;">
                        <strong style="color:var(--text-main, #222);">${safeName}</strong> &bull; ${safeEmail}
                    </div>
                    <div style="font-size:15px; color:var(--text-main, #333); line-height:1.6; white-space:pre-wrap; word-break:break-word; padding: 5px 0;">${safeDetails}</div>
                    <div style="display:flex; justify-content:flex-end; margin-top:5px;">
                        <button class="delete-complaint-btn" data-id="${ticket.id}" style="display:inline-flex; align-items:center; gap:6px; padding:8px 16px; background:#ea0038; color:white; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; transition: background 0.2s;">
                            <span class="material-symbols-rounded" style="font-size:18px;">delete</span> Delete
                        </button>
                    </div>
                `;

                // Handle delete action
                const delBtn = card.querySelector('.delete-complaint-btn');
                delBtn.onclick = async () => {
                    if (!confirm(`Are you sure you want to delete this complaint from "${ticket.name}"?`)) return;

                    delBtn.disabled = true;
                    delBtn.textContent = 'Deleting...';

                    try {
                        await deleteDoc(doc(db, "help_complaints", ticket.id));
                        card.remove();
                        if (complaintsList.children.length === 0) {
                            complaintsList.innerHTML = '<p style="text-align:center; color:var(--text-muted, #888); font-size: 16px; padding:50px 0;">No complaints registered yet.</p>';
                        }
                    } catch (err) {
                        console.error("Delete error:", err);
                        alert("Could not delete complaint: " + err.message);
                        delBtn.disabled = false;
                        delBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size:18px;">delete</span> Delete';
                    }
                };

                complaintsList.appendChild(card);
            });
        } catch (error) {
            console.error("Error retrieving complaints:", error);
            const safeError = String(error.message).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
            complaintsList.innerHTML = `<p style="text-align:center; color:#ea0038; padding:40px 0;">Error loading complaints: ${safeError}</p>`;
        }
    }
}
